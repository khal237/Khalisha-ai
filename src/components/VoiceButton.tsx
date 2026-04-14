import { Mic } from 'lucide-react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceButtonProps {
  state: VoiceState;
  onClick: () => void;
  showListeningHint?: boolean;
}

export function VoiceButton({ state, onClick, showListeningHint = false }: VoiceButtonProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">

        {/* Listening: pulsing ring */}
        {state === 'listening' && (
          <div className="absolute w-20 h-20 rounded-full border-2 border-primary animate-pulse-ring" />
        )}

        {/* Speaking: outer sound-wave rings */}
        {state === 'speaking' && (
          <>
            <div className="absolute w-24 h-24 rounded-full border border-emerald-400/40 animate-pulse-ring" style={{ animationDuration: '1.2s' }} />
            <div className="absolute w-20 h-20 rounded-full border border-emerald-400/60 animate-pulse-ring" style={{ animationDuration: '1.2s', animationDelay: '0.3s' }} />
          </>
        )}

        <button
          onClick={onClick}
          aria-label={state === 'listening' ? 'Arrêter' : 'Parler'}
          className={`
            relative z-10 w-16 h-16 rounded-full border-2 flex items-center justify-center
            transition-colors duration-200
            ${state === 'idle'      ? 'border-foreground/20 bg-background' : ''}
            ${state === 'listening' ? 'border-primary bg-primary/5' : ''}
            ${state === 'thinking'  ? 'border-foreground/30 bg-muted/40' : ''}
            ${state === 'speaking'  ? 'border-emerald-500 bg-emerald-500/5' : ''}
          `}
        >
          {/* Thinking: spinning arc overlay */}
          {state === 'thinking' && (
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/40 animate-spin" />
          )}

          {/* Speaking: sound-wave bars */}
          {state === 'speaking' ? (
            <div className="flex items-center gap-0.5 h-6">
              <span className="w-1 h-4 bg-emerald-500 rounded-full animate-sound-bar-1" />
              <span className="w-1 h-6 bg-emerald-500 rounded-full animate-sound-bar-2" />
              <span className="w-1 h-3 bg-emerald-500 rounded-full animate-sound-bar-3" />
              <span className="w-1 h-5 bg-emerald-500 rounded-full animate-sound-bar-2" />
              <span className="w-1 h-2 bg-emerald-500 rounded-full animate-sound-bar-1" />
            </div>
          ) : (
            <Mic
              size={24}
              className={
                state === 'listening' ? 'text-primary' :
                state === 'thinking'  ? 'text-foreground/40' :
                'text-foreground/60'
              }
            />
          )}
        </button>
      </div>

      {/* "Je vous écoute..." hint */}
      <p
        className={`text-xs text-muted-foreground transition-opacity duration-300 ${
          showListeningHint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Je vous écoute…
      </p>
    </div>
  );
}
