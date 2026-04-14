import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Download, Upload, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhraseForm } from '@/components/PhraseForm';
import { getAllPhrases, addPhrase, updatePhrase, deletePhrase, exportPhrases, importPhrases } from '@/services/db';
import type { Phrase } from '@/services/db';

export const Route = createFileRoute('/train')({
  head: () => ({
    meta: [
      { title: 'Entraîner — Khalisha' },
      { name: 'description', content: 'Ajoutez et gérez des paires de phrases Français-Bamoun.' },
    ],
  }),
  component: TrainPage,
});

// ── Small audio play button per row ──────────────────────────────────────────

function AudioPlayButton({ audioUrl }: { audioUrl: string | null | undefined }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioUrl) return;
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setPlaying(true);
    audio.onended = () => { audioRef.current = null; setPlaying(false); };
    audio.onerror = () => { audioRef.current = null; setPlaying(false); };
    audio.play();
  };

  if (!audioUrl) {
    return <span className="text-xs text-muted-foreground/60">Aucun audio</span>;
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      aria-label={playing ? 'Pause' : 'Écouter'}
    >
      {playing ? <Pause size={13} /> : <Play size={13} />}
      {playing ? 'Pause' : 'Écouter'}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function TrainPage() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);

  const load = () => getAllPhrases().then(setPhrases);
  useEffect(() => { load(); }, []);

  const handleAdd = async (data: Omit<Phrase, 'id' | 'audioUrl'>) => {
    await addPhrase(data);
    setShowForm(false);
    load();
  };

  const handleEdit = async (data: Omit<Phrase, 'id' | 'audioUrl'>) => {
    if (!editing?.id) return;
    await updatePhrase({ ...data, id: editing.id });
    setEditing(null);
    load();
  };

  const handleDelete = async (id: number) => {
    await deletePhrase(id);
    load();
  };

  const handleExport = async () => {
    try {
      await exportPhrases();
    } catch (err: any) {
      alert(`Erreur d'export : ${err.message}`);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        await importPhrases(file);
        load();
      } catch (err: any) {
        alert(`Erreur d'import : ${err.message}`);
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-base font-semibold text-foreground">Entraîner</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-8 h-8 flex items-center justify-center rounded-md text-primary hover:bg-accent"
          aria-label="Ajouter une phrase"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Add form */}
        {showForm && !editing && (
          <PhraseForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
        )}

        {/* Edit form */}
        {editing && (
          <PhraseForm initial={editing} onSubmit={handleEdit} onCancel={() => setEditing(null)} />
        )}

        {/* Empty state */}
        {phrases.length === 0 && !showForm && (
          <p className="text-center text-muted-foreground text-sm py-12">
            Aucune phrase. Appuyez sur + pour commencer.
          </p>
        )}

        {/* Phrase list */}
        {phrases.map(phrase => (
          <div key={phrase.id} className="flex items-start justify-between p-3 border border-border rounded-lg gap-2">
            <div className="flex-1 min-w-0 space-y-0.5">
              {/* French */}
              <p className="text-sm font-medium text-foreground">{phrase.french}</p>

              {/* Bamoun + phonetic */}
              <p className="text-sm text-primary">
                {phrase.bamoun || <span className="text-muted-foreground/60 italic">Bamoun non renseigné</span>}
                {phrase.phonetic && (
                  <span className="text-muted-foreground font-normal"> &nbsp;•&nbsp; [{phrase.phonetic}]</span>
                )}
              </p>

              {/* Audio */}
              <div className="pt-1">
                <AudioPlayButton audioUrl={phrase.audioUrl} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => { setShowForm(false); setEditing(phrase); }}
                className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Modifier"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => phrase.id && handleDelete(phrase.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-border">
        <Button variant="outline" size="sm" onClick={handleExport} className="flex-1 gap-1.5">
          <Download size={14} /> Exporter ZIP
        </Button>
        <Button variant="outline" size="sm" onClick={handleImport} className="flex-1 gap-1.5">
          <Upload size={14} /> Importer ZIP
        </Button>
      </div>
    </div>
  );
}
