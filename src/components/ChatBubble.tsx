interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export function ChatBubble({ role, content, streaming = false }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-bubble-user text-foreground rounded-br-md'
            : 'bg-bubble-assistant text-foreground border border-bubble-assistant-border rounded-bl-md'
        }`}
      >
        {content}
        {streaming && (
          <span className="inline-block w-0.5 h-3.5 bg-foreground/60 ml-0.5 align-middle animate-blink" />
        )}
      </div>
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-bubble-assistant border border-bubble-assistant-border px-4 py-3 rounded-2xl rounded-bl-md flex gap-1">
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
