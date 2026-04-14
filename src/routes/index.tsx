import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { VoiceButton } from '@/components/VoiceButton';
import type { VoiceState } from '@/components/VoiceButton';
import { ChatBubble, ThinkingIndicator } from '@/components/ChatBubble';
import { startListening, speak, StreamingSpeaker } from '@/services/speech';
import { sendMessage } from '@/services/ai';
import { getAllPhrases, getSettings } from '@/services/db';
import type { Phrase, Settings } from '@/services/db';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Khalisha — Assistante vocale Bamoun' },
      { name: 'description', content: 'Assistante vocale pour apprendre la langue Bamoun (Shupamem).' },
    ],
  }),
  component: ChatPage,
});

type Tab = 'text' | 'voice';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function ChatPage() {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('text');

  // ── Shared conversation state ─────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // ── Text tab state ────────────────────────────────────────────────────────
  const [textInput, setTextInput] = useState('');

  // ── Voice tab state ───────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [showListeningHint, setShowListeningHint] = useState(false);

  // ── Stable refs ───────────────────────────────────────────────────────────
  const messagesRef = useRef<ChatMessage[]>([]);
  const settingsRef = useRef<Settings | null>(null);
  const phrasesRef = useRef<Phrase[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speakerRef = useRef<StreamingSpeaker | null>(null);
  const stopListenRef = useRef<(() => void) | null>(null);
  const streamAccumRef = useRef('');
  const autoLoopCancelledRef = useRef(false);
  const hasGreeted = useRef(false);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { phrasesRef.current = phrases; }, [phrases]);

  useEffect(() => {
    getAllPhrases().then(setPhrases);
    getSettings().then(setSettings);
  }, []);

  // Greeting on first load
  useEffect(() => {
    const s = settings;
    if (s && !hasGreeted.current) {
      hasGreeted.current = true;
      const greeting = 'Bonjour, je suis Khalisha.';
      setMessages([{ role: 'assistant', content: greeting }]);
      speak(greeting, s.voiceName, s.voiceSpeed);
    }
  }, [settings]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  // ── Cancel everything when switching tabs ─────────────────────────────────
  const switchTab = useCallback((next: Tab) => {
    if (next === tab) return;
    autoLoopCancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    speakerRef.current?.stop();
    speakerRef.current = null;
    stopListenRef.current?.();
    stopListenRef.current = null;
    setIsThinking(false);
    setIsStreaming(false);
    setVoiceState('idle');
    setShowListeningHint(false);
    setTab(next);
  }, [tab]);

  // ── Auto-listen (voice tab only) ──────────────────────────────────────────
  const startAutoListen = useCallback(() => {
    setVoiceState('listening');
    setShowListeningHint(false);
    const stop = startListening(
      (text) => {
        stopListenRef.current = null;
        handleVoiceResponse(text); // eslint-disable-line @typescript-eslint/no-use-before-define
      },
      () => {
        stopListenRef.current = null;
        setVoiceState('idle');
      },
    );
    if (!stop) { setVoiceState('idle'); return; }
    stopListenRef.current = stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared core: stream a response, optionally with TTS ───────────────────
  const handleResponse = useCallback(async (
    userText: string,
    withTTS: boolean,
  ) => {
    const settings = settingsRef.current;
    const phrases = phrasesRef.current;
    const history = messagesRef.current;
    if (!settings) return;

    autoLoopCancelledRef.current = false;

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userText },
      { role: 'assistant', content: '' },
    ]);
    streamAccumRef.current = '';
    setIsThinking(true);
    setIsStreaming(false);
    if (withTTS) setVoiceState('thinking');

    const abort = new AbortController();
    abortRef.current = abort;

    let speaker: StreamingSpeaker | null = null;
    if (withTTS) {
      speaker = new StreamingSpeaker({
        voiceName: settings.voiceName,
        onSpeakStart: () => setVoiceState('speaking'),
        onDone: () => {
          speakerRef.current = null;
          setVoiceState('idle');
          setShowListeningHint(true);
          setTimeout(() => {
            if (!autoLoopCancelledRef.current) {
              startAutoListen();
            } else {
              setShowListeningHint(false);
            }
          }, 400);
        },
      });
      speakerRef.current = speaker;
    }

    try {
      await sendMessage(
        userText,
        phrases,
        history,
        (chunk) => {
          streamAccumRef.current += chunk;
          const accumulated = streamAccumRef.current;
          setIsThinking(false);
          setIsStreaming(true);
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: accumulated };
            return next;
          });
          scrollToBottom();
          speaker?.push(chunk);
        },
        abort.signal,
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setMessages(prev => {
        const next = [...prev];
        if (next[next.length - 1]?.role === 'assistant' && !next[next.length - 1].content) {
          next[next.length - 1] = { role: 'assistant', content: err.message || 'Erreur de connexion.' };
        } else {
          next.push({ role: 'assistant', content: err.message || 'Erreur de connexion.' });
        }
        return next;
      });
      if (withTTS) setVoiceState('idle');
    } finally {
      setIsThinking(false);
      setIsStreaming(false);
      abortRef.current = null;
      if (speaker) {
        speaker.flush();
      } else if (withTTS) {
        setVoiceState('idle');
      }
      scrollToBottom();
    }
  }, [scrollToBottom, startAutoListen]);

  // ── Text tab: send on button click or Enter ───────────────────────────────
  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text || isThinking || isStreaming) return;
    setTextInput('');
    handleResponse(text, false);
  }, [textInput, isThinking, isStreaming, handleResponse]);

  const handleTextKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  }, [handleTextSend]);

  // ── Voice tab: mic button (also handles interrupt) ────────────────────────
  const handleVoiceResponse = useCallback((text: string) => {
    handleResponse(text, true);
  }, [handleResponse]);

  const handleMicClick = useCallback(() => {
    // Interrupt while speaking or thinking
    if (voiceState === 'speaking' || voiceState === 'thinking') {
      autoLoopCancelledRef.current = true;
      speakerRef.current?.stop();
      speakerRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
      setIsThinking(false);
      setIsStreaming(false);
      setShowListeningHint(false);
      setVoiceState('listening');
      const stop = startListening(
        (text) => { stopListenRef.current = null; handleVoiceResponse(text); },
        () => { stopListenRef.current = null; setVoiceState('idle'); },
      );
      if (!stop) { setVoiceState('idle'); return; }
      stopListenRef.current = stop;
      return;
    }

    // Stop if already listening
    if (voiceState === 'listening') {
      autoLoopCancelledRef.current = true;
      stopListenRef.current?.();
      stopListenRef.current = null;
      setVoiceState('idle');
      setShowListeningHint(false);
      return;
    }

    // Idle → start listening
    autoLoopCancelledRef.current = false;
    setVoiceState('listening');
    const stop = startListening(
      (text) => { stopListenRef.current = null; handleVoiceResponse(text); },
      () => { stopListenRef.current = null; setVoiceState('idle'); },
    );
    if (!stop) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'La reconnaissance vocale n\'est pas disponible sur ce navigateur.',
      }]);
      setVoiceState('idle');
      return;
    }
    stopListenRef.current = stop;
  }, [voiceState, handleVoiceResponse]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-64px)]">
      {/* Header + tab bar */}
      <header className="flex-none border-b border-border">
        <div className="flex items-center px-4 pt-3 pb-0">
          <h1 className="text-base font-semibold text-foreground">Khalisha</h1>
        </div>
        <div className="flex gap-1 mx-4 my-2 p-1 bg-muted rounded-xl">
          <button
            onClick={() => switchTab('text')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              tab === 'text'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chat écrit
          </button>
          <button
            onClick={() => switchTab('voice')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              tab === 'voice'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chat vocal
          </button>
        </div>
      </header>

      {/* ── Text tab ──────────────────────────────────────────────────────── */}
      {tab === 'text' && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                role={msg.role}
                content={msg.content}
                streaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
              />
            ))}
            {isThinking && <ThinkingIndicator />}
          </div>

          <div className="flex-none flex gap-2 px-4 py-3 border-t border-border">
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={handleTextKeyDown}
              placeholder="Écrire un message…"
              disabled={isThinking || isStreaming}
              className="flex-1 px-3 py-2 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 placeholder:text-muted-foreground"
            />
            <button
              onClick={handleTextSend}
              disabled={!textInput.trim() || isThinking || isStreaming}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl disabled:opacity-40 transition-opacity"
            >
              Envoyer
            </button>
          </div>
        </>
      )}

      {/* ── Voice tab ─────────────────────────────────────────────────────── */}
      {tab === 'voice' && (
        <>
          {/* Read-only transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                role={msg.role}
                content={msg.content}
                streaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
              />
            ))}
            {isThinking && <ThinkingIndicator />}
          </div>

          {/* Mic button */}
          <div className="flex-none flex items-center justify-center py-6 border-t border-border">
            <VoiceButton
              state={voiceState}
              onClick={handleMicClick}
              showListeningHint={showListeningHint}
            />
          </div>
        </>
      )}
    </div>
  );
}
