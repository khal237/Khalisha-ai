export function speak(text: string, voiceName?: string, rate = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = rate;

    if (voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === voiceName);
      if (voice) utterance.voice = voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

export function startListening(onResult: (text: string) => void, onEnd: () => void): (() => void) | null {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onend = () => onEnd();
  recognition.onerror = () => onEnd();
  recognition.start();

  return () => {
    try { recognition.stop(); } catch {}
  };
}

export async function recordAudioBlob(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      resolve(new Blob(chunks, { type: 'audio/webm' }));
    };
    recorder.onerror = reject;
    recorder.start();
    setTimeout(() => recorder.stop(), 5000);
  });
}

// ─── Clean text before sending to SpeechSynthesis ────────────────────────────

export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'bloc de code') // code blocks → spoken label
    .replace(/`[^`]*`/g, '')                     // inline code → remove
    .replace(/#{1,6}\s/g, '')                    // markdown headers
    .replace(/\*\*(.*?)\*\*/g, '$1')             // bold → keep text
    .replace(/\*(.*?)\*/g, '$1')                 // italic → keep text
    .replace(/~~(.*?)~~/g, '$1')                 // strikethrough → keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // links → keep label
    .replace(/^[-*+]\s/gm, '')                   // bullet points
    .replace(/^\d+\.\s/gm, '')                   // numbered lists
    .replace(/^>\s/gm, '')                       // blockquotes
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')         // underscores
    .replace(/\n{2,}/g, '. ')                    // double newlines → pause
    .replace(/\n/g, ' ')                         // single newlines → space
    .replace(/[|\\^~<>{}]/g, '')                 // misc symbols
    .replace(/\s{2,}/g, ' ')                     // collapse multiple spaces
    .trim();
}

// ─── Streaming TTS ────────────────────────────────────────────────────────────

interface StreamingSpeakerOptions {
  voiceName?: string;
  onSpeakStart?: () => void;
  onDone?: () => void;
}

// Sentence boundary: . ! ? or newline
const SENTENCE_END = /[.!?\n]/;

function pickFrenchVoice(preferred?: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (preferred) {
    const exact = voices.find(v => v.name === preferred);
    if (exact) return exact;
  }
  return voices.find(v => v.lang.startsWith('fr')) ?? null;
}

export class StreamingSpeaker {
  private buffer = '';
  private queue: string[] = [];
  private isSpeaking = false;
  private streamDone = false;
  private hasStarted = false;
  private stopped = false;

  constructor(private opts: StreamingSpeakerOptions) {}

  push(chunk: string) {
    this.buffer += chunk;
    this.drainBuffer();
  }

  flush() {
    this.streamDone = true;
    const remaining = this.buffer.trim();
    this.buffer = '';
    if (remaining) this.queue.push(remaining);
    if (!this.isSpeaking) this.playNext();
  }

  stop() {
    this.stopped = true;
    this.queue = [];
    this.buffer = '';
    this.isSpeaking = false;
    window.speechSynthesis?.cancel();
  }

  private drainBuffer() {
    let idx = this.buffer.search(SENTENCE_END);
    while (idx !== -1) {
      const sentence = this.buffer.slice(0, idx + 1).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (sentence) {
        this.queue.push(sentence);
        if (!this.isSpeaking) this.playNext();
      }
      idx = this.buffer.search(SENTENCE_END);
    }
  }

  private playNext() {
    if (this.stopped) return;
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      if (this.streamDone) this.opts.onDone?.();
      return;
    }
    this.isSpeaking = true;
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.opts.onSpeakStart?.();
    }
    const raw = this.queue.shift()!;
    const text = cleanTextForSpeech(raw);
    if (!text) {
      // Nothing to say after cleaning — skip silently
      this.playNext();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    const voice = pickFrenchVoice(this.opts.voiceName);
    if (voice) utterance.voice = voice;
    utterance.onend = () => { if (!this.stopped) this.playNext(); };
    utterance.onerror = () => { if (!this.stopped) this.playNext(); };
    window.speechSynthesis.speak(utterance);
  }
}
