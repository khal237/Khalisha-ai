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
  const [settings, setSettings] = useState<Settings>({
    aiProvider: 'openai',
    apiKey: '',
    voiceSpeed: 1,
    voiceName: '',
    model: 'gpt-4o',
  });
  const [apiKey, setApiKey] = useState(localStorage.getItem('apiKey') || '');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      // localStorage is authoritative for the API key; only fall back to IDB if localStorage is empty
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
    const merged = { ...settings, apiKey };
    await saveSettings(merged);
    localStorage.setItem('apiKey', apiKey);
    console.log('API key saved:', localStorage.getItem('apiKey'));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (patch: Partial<Settings>) => setSettings(prev => ({ ...prev, ...patch }));

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)]">
      <header className="flex items-center px-4 py-3 border-b border-border">
        <h1 className="text-base font-semibold text-foreground">Paramètres</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Fournisseur AI</h2>
          <div className="space-y-2">
            {(['openai', 'anthropic', 'custom'] as const).map(provider => (
              <label key={provider} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  checked={settings.aiProvider === provider}
                  onChange={() => update({ aiProvider: provider })}
                  className="accent-primary"
                />
                <span className="text-foreground capitalize">{provider === 'custom' ? 'URL personnalisée' : provider === 'openai' ? 'OpenAI' : 'Anthropic'}</span>
              </label>
            ))}
          </div>
        </section>

        {settings.aiProvider === 'custom' && (
          <section className="space-y-2">
            <label className="block text-sm font-medium text-foreground">URL de l'API</label>
            <input
              type="url"
              value={settings.customUrl || ''}
              onChange={e => update({ customUrl: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://api.example.com/v1/chat/completions"
            />
          </section>
        )}

        <section className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Clé API</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="sk-..."
          />
        </section>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Modèle</label>
          <input
            type="text"
            value={settings.model}
            onChange={e => update({ model: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="gpt-4o"
          />
        </section>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Vitesse de la voix: {settings.voiceSpeed.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.voiceSpeed}
            onChange={e => update({ voiceSpeed: parseFloat(e.target.value) })}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5x</span>
            <span>2x</span>
          </div>
        </section>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Voix</label>
          <select
            value={settings.voiceName}
            onChange={e => update({ voiceName: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Par défaut</option>
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
