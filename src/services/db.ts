import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import JSZip from 'jszip';

export interface Phrase {
  id?: number;
  french: string;
  bamoun: string;
  phonetic?: string;
  audioBlob?: Blob | null;
  audioUrl?: string | null;  // generated at load time, never stored
  createdAt: number;
}

export interface Settings {
  aiProvider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  customUrl?: string;
  voiceSpeed: number;
  voiceName: string;
  model: string;
}

interface KhalishaDB extends DBSchema {
  phrases: {
    key: number;
    value: Phrase;
    indexes: { 'by-created': number };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let dbPromise: Promise<IDBPDatabase<KhalishaDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<KhalishaDB>('khalisha-db', 1, {
      upgrade(db) {
        const phraseStore = db.createObjectStore('phrases', { keyPath: 'id', autoIncrement: true });
        phraseStore.createIndex('by-created', 'createdAt');
        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

function withAudioUrl(phrase: Phrase): Phrase {
  return {
    ...phrase,
    audioUrl: phrase.audioBlob ? URL.createObjectURL(phrase.audioBlob) : null,
  };
}

export async function getAllPhrases(): Promise<Phrase[]> {
  const db = await getDB();
  const raw = await db.getAllFromIndex('phrases', 'by-created');
  return raw.map(withAudioUrl);
}

export async function addPhrase(phrase: Omit<Phrase, 'id' | 'audioUrl'>): Promise<number> {
  const db = await getDB();
  const { audioUrl, ...stored } = phrase as Phrase;
  return db.add('phrases', stored as Phrase);
}

export async function updatePhrase(phrase: Phrase): Promise<void> {
  const db = await getDB();
  const { audioUrl, ...stored } = phrase;
  await db.put('phrases', stored as Phrase);
}

export async function deletePhrase(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('phrases', id);
}

// ── ZIP export ────────────────────────────────────────────────────────────────

export async function exportPhrases(): Promise<void> {
  const db = await getDB();
  const raw = await db.getAllFromIndex('phrases', 'by-created');

  const zip = new JSZip();
  const audioFolder = zip.folder('audio')!;

  const textData = raw.map((p, i) => {
    const { audioBlob, audioUrl, ...rest } = p;
    return {
      ...rest,
      audioFile: audioBlob ? `audio/${i + 1}.webm` : null,
    };
  });

  zip.file('phrases.json', JSON.stringify(textData, null, 2));

  for (let i = 0; i < raw.length; i++) {
    const blob = raw[i].audioBlob;
    if (blob) audioFolder.file(`${i + 1}.webm`, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'khalisha-phrases.zip';
  a.click();
  URL.revokeObjectURL(url);
}

// ── ZIP import ────────────────────────────────────────────────────────────────

export async function importPhrases(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(file);

  const jsonFile = zip.file('phrases.json');
  if (!jsonFile) throw new Error('Invalid ZIP: phrases.json not found');
  const json = await jsonFile.async('string');
  const records = JSON.parse(json) as Array<Omit<Phrase, 'audioBlob' | 'audioUrl'> & { audioFile?: string | null }>;

  const db = await getDB();
  const tx = db.transaction('phrases', 'readwrite');
  for (const record of records) {
    const { audioFile, ...base } = record;
    let audioBlob: Blob | null = null;
    if (audioFile) {
      const audioEntry = zip.file(audioFile);
      if (audioEntry) {
        const data = await audioEntry.async('blob');
        audioBlob = new Blob([data], { type: 'audio/webm' });
      }
    }
    await tx.store.add({
      ...base,
      audioBlob,
      createdAt: base.createdAt || Date.now(),
    } as Phrase);
  }
  await tx.done;
}

// ── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'openai',
  apiKey: '',
  voiceSpeed: 1,
  voiceName: '',
  model: 'gpt-4o',
};

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const settings = await db.get('settings', 'main');
  return settings || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, 'main');
}
