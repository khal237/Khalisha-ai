import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getSettings, saveSettings } from '@/services/db';
import { getAvailableVoices } from '@/services/speech';
import type { Settings } from '@/services/db';

export const Route = createFileRoute('/settings')({
  head: () => ({
    meta: [
      { title: 'Paramètres — Khalisha' },
      { name: 'description', content: 'Configurez votre assistant vocal Khalisha.' },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  // Guard: should never run outside a browser, but protects against SSR/edge contexts.
  if (typeof window === 'undefined') return null;

  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voiceName, setVoiceName] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('apiKey') ?? '');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s: Settings) => {
      // Merge with safe fallbacks in case IDB stored an older schema
      setVoiceSpeed(typeof s.voiceSpeed === 'number' ? s.voiceSpeed : 1);
      setVoiceName(s.voiceName ?? '');
      // localStorage is authoritative for the API key
      if (!localStorage.getItem('apiKey') && s.apiKey) {
        setApiKey(s.apiKey);
      }
    });

    const loadVoices = () => setVoices(getAvailableVoices());
    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const handleSave = async () => {
    const current = await getSettings();
    await saveSettings({ ...current, apiKey, voiceSpeed, voiceName });
    localStorage.setItem('apiKey', apiKey);
    console.log('API key saved:', localStorage.getItem('apiKey'));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputCls = 'w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)]">
      <header className="flex items-center px-4 py-3 border-b border-border">
        <h1 className="text-base font-semibold text-foreground">Paramètres</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

        {/* Gemini API key */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Clé API Gemini</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className={inputCls}
            placeholder="AIza..."
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Obtenez votre clé sur <span className="font-medium">aistudio.google.com</span>
          </p>
        </section>

        {/* Voice speed */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Vitesse de la voix : {voiceSpeed.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={voiceSpeed}
            onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5x</span>
            <span>2x</span>
          </div>
        </section>

        {/* Voice selection */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Voix de synthèse</label>
          <select
            value={voiceName}
            onChange={e => setVoiceName(e.target.value)}
            className={inputCls}
          >
            <option value="">Par défaut (première voix française)</option>
            {voices.map(v => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </section>

      </div>

      <div className="px-4 py-3 border-t border-border">
        <Button onClick={handleSave} className="w-full">
          {saved ? 'Clé API sauvegardée' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
