import type { Phrase } from './db';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface GeminiMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

function buildSystemPrompt(trainingData: Phrase[]): string {
  const pairs = trainingData.map(p => {
    const audioNote = p.audioBlob ? ' (prononciation audio disponible)' : '';
    let entry = `Français: "${p.french}" → Bamoun: "${p.bamoun || '?'}" Phonétique: "${p.phonetic || '?'}"${audioNote}`;
    return entry;
  }).join('\n');

  return `Tu es Khalisha, une assistante vocale spécialisée dans la langue Bamoun (Shupamem) du Cameroun occidental. Tu es précise, pédagogique et professionnelle.\n\nRéférence linguistique Bamoun validée :\n${pairs}\n\nPour chaque réponse, fournis la phrase en Bamoun, sa prononciation phonétique et sa traduction française.\n\nRéponds toujours en texte simple et naturel, sans markdown, sans astérisques, sans tirets, sans titres. Écris comme si tu parlais à voix haute.`;
}

function toGeminiHistory(history: Message[], userText: string): GeminiMessage[] {
  const messages: GeminiMessage[] = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  messages.push({ role: 'user', parts: [{ text: userText }] });
  return messages;
}

export async function sendMessage(
  userText: string,
  trainingData: Phrase[],
  history: Message[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const apiKey = localStorage.getItem('apiKey');
  console.log('API key found:', !!apiKey);
  if (!apiKey) {
    throw new Error('Veuillez configurer votre clé API dans les paramètres.');
  }

  const systemPrompt = buildSystemPrompt(trainingData);
  const conversationHistory = toGeminiHistory(history, userText);

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: conversationHistory,
      }),
      signal,
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error: ${err}`);
  }

  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunk) onChunk(chunk);
        } catch {}
      }
    }
  }
}
