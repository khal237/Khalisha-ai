import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioRecorder } from '@/services/recorder';
import type { Phrase } from '@/services/db';

interface PhraseFormProps {
  initial?: Phrase;
  onSubmit: (data: Omit<Phrase, 'id' | 'audioUrl'>) => void;
  onCancel: () => void;
}

type RecordState = 'idle' | 'recording' | 'done';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PhraseForm({ initial, onSubmit, onCancel }: PhraseFormProps) {
  const [french, setFrench] = useState(initial?.french ?? '');
  const [bamoun, setBamoun] = useState(initial?.bamoun ?? '');
  const [phonetic, setPhonetic] = useState(initial?.phonetic ?? '');

  // Audio state
  const [recordState, setRecordState] = useState<RecordState>(
    initial?.audioBlob ? 'done' : 'idle',
  );
  const [audioBlob, setAudioBlob] = useState<Blob | null>(initial?.audioBlob ?? null);
  const [audioUrl, setAudioUrl] = useState<string | null>(initial?.audioUrl ?? null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep a fresh object URL when audioBlob changes
  useEffect(() => {
    if (!audioBlob) { setAudioUrl(null); return; }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  // Clean up timer on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleStartRecording = async () => {
    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      setRecordState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      alert('Impossible d\'accéder au microphone.');
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!recorderRef.current) return;
    const blob = await recorderRef.current.stop();
    recorderRef.current = null;
    setAudioBlob(blob);
    setRecordState('done');
  };

  const handlePlay = () => {
    if (!audioUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setIsPlaying(true);
    audio.onended = () => { audioRef.current = null; setIsPlaying(false); };
    audio.onerror = () => { audioRef.current = null; setIsPlaying(false); };
    audio.play();
  };

  const handleDeleteAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordState('idle');
    setDuration(0);
    setIsPlaying(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!french.trim()) return;
    onSubmit({
      french: french.trim(),
      bamoun: bamoun.trim(),
      phonetic: phonetic.trim() || undefined,
      audioBlob: audioBlob ?? null,
      createdAt: initial?.createdAt ?? Date.now(),
    });
  };

  const inputCls = 'w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-border rounded-lg bg-card">
      {/* French */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Français *</label>
        <input type="text" value={french} onChange={e => setFrench(e.target.value)}
          className={inputCls} placeholder="Bonjour" required />
      </div>

      {/* Bamoun */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Bamoun (optionnel)</label>
        <input type="text" value={bamoun} onChange={e => setBamoun(e.target.value)}
          className={inputCls} placeholder="Mo fon wa" />
      </div>

      {/* Phonetic */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Phonétique (optionnel)</label>
        <input type="text" value={phonetic} onChange={e => setPhonetic(e.target.value)}
          className={inputCls} placeholder="Mo-fon-wa" />
      </div>

      {/* Audio recorder */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Mic size={13} className="text-primary" /> Prononciation en Bamoun
        </p>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {recordState !== 'recording' ? (
            <button
              type="button"
              onClick={handleStartRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Mic size={12} /> Enregistrer
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors animate-pulse"
            >
              <Square size={12} /> Arrêter
            </button>
          )}

          <button
            type="button"
            onClick={handlePlay}
            disabled={!audioBlob}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent disabled:opacity-40 transition-colors"
          >
            <Play size={12} className={isPlaying ? 'text-primary' : ''} />
            {isPlaying ? 'Pause' : 'Écouter'}
          </button>

          <button
            type="button"
            onClick={handleDeleteAudio}
            disabled={!audioBlob}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-input bg-background hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 transition-colors ml-auto"
            aria-label="Supprimer l'enregistrement"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Duration + waveform indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground w-8">
            {formatDuration(duration)}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
            {recordState === 'recording' ? (
              <div className="h-full bg-destructive rounded-full animate-waveform" />
            ) : recordState === 'done' ? (
              <div className="h-full bg-primary rounded-full w-full opacity-60" />
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">
            {recordState === 'idle' && 'Aucun enregistrement'}
            {recordState === 'recording' && 'Enregistrement…'}
            {recordState === 'done' && 'Prêt'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm">{initial ? 'Modifier' : 'Ajouter'}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}
