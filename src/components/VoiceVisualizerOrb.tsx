import React from 'react';
import { VoiceState } from '../types';

interface VoiceVisualizerOrbProps {
  voiceState: VoiceState;
  audioVolume: number; // 0 to 1
  isAgentVolume: boolean;
  isConnected: boolean;
}

export const VoiceVisualizerOrb: React.FC<VoiceVisualizerOrbProps> = ({
  voiceState,
  audioVolume,
  isConnected,
}) => {
  const vol = Math.max(0, Math.min(1, audioVolume));
  const scale = isConnected ? 1 + vol * 0.35 : 1;

  // Modern circular voice ring palette (Warm Sunset / Golden Amber)
  const isSpeaking = voiceState === 'speaking';
  const isListening = voiceState === 'listening';

  return (
    <div className="relative flex flex-col items-center justify-center py-4 select-none shrink-0">
      {/* Concentric soundwaves */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {isConnected && (
          <>
            {/* Outer soundwave ring 1 */}
            <div
              className={`absolute inset-0 rounded-full border border-amber-400/40 transition-transform duration-100 ease-out ${
                isSpeaking ? 'animate-ping' : ''
              }`}
              style={{
                transform: `scale(${1.1 + vol * 0.4})`,
                opacity: 0.3 + vol * 0.5,
              }}
            />
            {/* Outer soundwave ring 2 */}
            <div
              className="absolute inset-[-12px] rounded-full border border-orange-400/30 transition-transform duration-150 ease-out"
              style={{
                transform: `scale(${1.2 + vol * 0.6})`,
                opacity: 0.2 + vol * 0.4,
              }}
            />
          </>
        )}

        {/* Ambient atmospheric glow */}
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 via-orange-400 to-rose-400 blur-2xl transition-all duration-200"
          style={{
            transform: `scale(${scale * 1.1})`,
            opacity: isConnected ? 0.45 + vol * 0.4 : 0.2,
          }}
        />

        {/* The clean spherical Voice Orb */}
        <div
          className="relative w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 shadow-xl flex items-center justify-center transition-transform duration-100 ease-out"
          style={{
            transform: `scale(${scale})`,
            boxShadow: isConnected
              ? `0 0 35px rgba(251, 146, 60, ${0.5 + vol * 0.5})`
              : '0 8px 20px rgba(251, 146, 60, 0.25)',
          }}
        >
          {/* Inner ambient glow layer */}
          <div className="absolute inset-1.5 rounded-full bg-gradient-to-tr from-amber-200/50 to-white/40 blur-[2px]" />

          {/* Clean audio frequency wave bars inside the sphere */}
          <div className="flex items-center gap-1 z-10">
            {isConnected ? (
              [0, 1, 2, 3, 4].map((i) => {
                const dynamicHeight = Math.max(
                  6,
                  Math.min(32, 10 + vol * 28 + (isSpeaking || isListening ? Math.sin(Date.now() / 150 + i) * 8 : 0))
                );
                return (
                  <div
                    key={i}
                    className="w-1.5 bg-white rounded-full transition-all duration-75 ease-out shadow-xs"
                    style={{
                      height: `${dynamicHeight}px`,
                      opacity: 0.9,
                    }}
                  />
                );
              })
            ) : (
              <div className="w-3 h-3 rounded-full bg-white/80 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Voice state indicator */}
      <div className="mt-3 text-center">
        <p className="text-xs font-bold text-stone-800 tracking-tight flex items-center justify-center gap-1.5">
          {isConnected ? (
            isSpeaking ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Jewfren speaking</span>
              </>
            ) : isListening ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Listening...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Connected</span>
              </>
            )
          ) : (
            <span className="text-stone-500">Tap Call to speak</span>
          )}
        </p>
      </div>
    </div>
  );
};
