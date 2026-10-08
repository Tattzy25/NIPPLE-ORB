import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  Minimize2,
  X,
  Volume2,
} from 'lucide-react';
import { CallStatus, VoiceState, TranscriptItem, SharedImageItem } from '../types';
import { VoiceVisualizerOrb } from './VoiceVisualizerOrb';
import { MediaGalleryModal } from './MediaGalleryModal';
import { ImageUploadModal } from './ImageUploadModal';

interface JewfrenBubbleWidgetProps {
  initialOpen?: boolean;
}

export const JewfrenBubbleWidget: React.FC<JewfrenBubbleWidgetProps> = ({
  initialOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const [activeTab, setActiveTab] = useState<'voice' | 'moments'>('voice');

  // Realtime Call & Voice states
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [isAgentVolume, setIsAgentVolume] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic visual moments
  const [sharedImages, setSharedImages] = useState<SharedImageItem[]>(() => {
    try {
      const saved = localStorage.getItem('jewfren_images');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Audio & Speech recognition references
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);
  const isListeningRef = useRef<boolean>(false);
  const voiceStateRef = useRef<VoiceState>('idle');
  const conversationMessagesRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const updateVoiceState = (state: VoiceState) => {
    voiceStateRef.current = state;
    setVoiceState(state);
  };

  // Sync images with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('jewfren_images', JSON.stringify(sharedImages));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [sharedImages]);

  // Handle call duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callStatus === 'idle') {
        setCallDuration(0);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Initialize Audio Player for Shimmer voice
  useEffect(() => {
    const audio = new Audio();
    audioPlayerRef.current = audio;

    audio.onplay = () => {
      updateVoiceState('speaking');
      setIsAgentVolume(true);
      setAudioVolume(0.85);
    };

    audio.onended = () => {
      updateVoiceState('listening');
      setIsAgentVolume(false);
      setAudioVolume(0);
      startSpeechRecognition();
    };

    audio.onerror = (e) => {
      console.warn('Audio play notice:', e);
      updateVoiceState('idle');
      setIsAgentVolume(false);
      setAudioVolume(0);
    };

    return () => {
      audio.pause();
    };
  }, []);

  // Web Speech Recognition for continuous live voice
  const startSpeechRecognition = () => {
    if (isMuted || callStatus !== 'connected') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListeningRef.current = true;
        updateVoiceState('listening');
        setIsAgentVolume(false);
        setAudioVolume(0.35);
      };

      recognition.onresult = (event: any) => {
        const spokenText = event.results[0]?.[0]?.transcript;
        if (spokenText && spokenText.trim()) {
          sendVoiceTurn(spokenText.trim());
        }
      };

      recognition.onerror = (err: any) => {
        isListeningRef.current = false;
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn('Speech recognition notice:', err.error);
        }
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        if (callStatus === 'connected' && voiceStateRef.current !== 'speaking' && !isMuted) {
          setTimeout(() => {
            if (callStatus === 'connected' && voiceStateRef.current !== 'speaking' && !isMuted) {
              startSpeechRecognition();
            }
          }, 250);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Recognition start notice:', e);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
  };

  // Execute conversational voice turn maintaining the full live session history
  const sendVoiceTurn = async (userText: string) => {
    if (!userText.trim()) return;

    stopSpeechRecognition();
    updateVoiceState('processing');

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Add user turn to live captions
    const userItem: TranscriptItem = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp,
    };
    setTranscripts((prev) => [...prev, userItem]);

    // 2. Add to session history
    conversationMessagesRef.current.push({ role: 'user', content: userText });

    try {
      const res = await fetch('/api/chat-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessagesRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Could not reach Jewfren.');
      }

      const replyText = data.text;
      conversationMessagesRef.current.push({ role: 'assistant', content: replyText });

      // Add assistant turn to captions
      const assistantItem: TranscriptItem = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTranscripts((prev) => [...prev, assistantItem]);

      // Play Jewfren's Shimmer voice
      if (data.audioUrl && audioPlayerRef.current) {
        audioPlayerRef.current.src = data.audioUrl;
        audioPlayerRef.current.play().catch((err) => {
          console.warn('Playback notice:', err);
          updateVoiceState('listening');
          startSpeechRecognition();
        });
      } else {
        updateVoiceState('listening');
        startSpeechRecognition();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error.');
      updateVoiceState('idle');
    }
  };

  // Start Call (Voice Only - No fake greeting injected, waits for user to speak)
  const handleStartCall = async () => {
    setErrorMessage(null);
    setCallStatus('connecting');

    try {
      // Request mic permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (e: any) {
        console.warn('Mic check note:', e);
      }

      setCallStatus('connected');
      updateVoiceState('listening');
      startSpeechRecognition();
    } catch (err: any) {
      setCallStatus('idle');
      updateVoiceState('idle');
      setErrorMessage(err.message || 'Failed to start call.');
    }
  };

  // End Call / Hang Up
  const handleEndCall = () => {
    stopSpeechRecognition();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setCallStatus('idle');
    updateVoiceState('idle');
    setAudioVolume(0);
    setIsAgentVolume(false);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      stopSpeechRecognition();
      updateVoiceState('idle');
    } else {
      if (callStatus === 'connected' && voiceStateRef.current !== 'speaking') {
        startSpeechRecognition();
      }
    }
  };

  const handleSendImage = async (base64Url: string, captionText?: string): Promise<boolean> => {
    const newImage: SharedImageItem = {
      id: `img-${Date.now()}`,
      sender: 'user',
      url: base64Url,
      title: captionText || 'Shared Photo',
      caption: captionText || '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSharedImages((prev) => [newImage, ...prev]);

    const prompt = captionText
      ? `I just shared a photo: "${captionText}"`
      : 'I just shared a photo with you, Jewfren.';
    sendVoiceTurn(prompt);

    return true;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isConnected = callStatus === 'connected';
  const isConnecting = callStatus === 'connecting';

  return (
    <>
      {/* 1. COMPACT FLOATING BUBBLE PILL BUTTON */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 select-none">
          {isConnected && (
            <div className="flex items-center gap-2 bg-stone-900 text-white px-3 py-1.5 rounded-full shadow-xl border border-stone-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono font-bold">{formatTime(callDuration)}</span>
              <button
                onClick={handleToggleMute}
                className="p-1 rounded-full text-stone-300 hover:text-white"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleEndCall}
                className="p-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white"
                title="Hang up"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 p-1.5 pr-3.5 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all text-stone-900 border-2 border-white cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-xs">
              <Phone className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-stone-900 leading-none">Jewfren</div>
              <div className="text-[10px] text-stone-800/80 font-medium">
                {isConnected ? 'In Call' : 'Tap to Call'}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 2. SLEEK, TIGHT FLOATING LIVE BUBBLE (STRICTLY VOICE ONLY - NO TEXT INPUTS) */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[310px] max-w-[calc(100vw-2.5rem)] h-[440px] max-h-[calc(100vh-2.5rem)] flex flex-col bg-white rounded-3xl shadow-2xl border border-amber-200 overflow-hidden select-none">
          {/* Header */}
          <div className="shrink-0 px-3.5 py-2.5 flex items-center justify-between border-b border-amber-100 bg-gradient-to-b from-amber-50/80 to-white">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-amber-300 to-orange-300 flex items-center justify-center shadow-xs shrink-0">
                <Phone className="w-4 h-4 text-stone-800" />
                <span
                  className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-white ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-extrabold text-stone-900 leading-tight">Jewfren</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900">
                    Voice S2S
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 leading-tight">
                  {isConnected ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live · {formatTime(callDuration)}
                    </span>
                  ) : (
                    <span>Voice-only companion</span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all"
              title="Minimize"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Friendly notice */}
          {errorMessage && (
            <div className="shrink-0 px-3 py-1.5 bg-rose-50 border-b border-rose-200 text-[11px] text-rose-800 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Sub tabs (if images exist) */}
          {sharedImages.length > 0 && (
            <div className="shrink-0 flex items-center px-3 pt-1 border-b border-stone-100 bg-white">
              <button
                onClick={() => setActiveTab('voice')}
                className={`flex-1 py-1 text-[11px] font-bold border-b-2 transition-all ${
                  activeTab === 'voice' ? 'border-amber-500 text-amber-900' : 'border-transparent text-stone-400'
                }`}
              >
                Voice Call
              </button>
              <button
                onClick={() => setActiveTab('moments')}
                className={`flex-1 py-1 text-[11px] font-bold border-b-2 transition-all ${
                  activeTab === 'moments' ? 'border-amber-500 text-amber-900' : 'border-transparent text-stone-400'
                }`}
              >
                Photos ({sharedImages.length})
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col justify-between">
            {activeTab === 'voice' && (
              <div className="flex-1 min-h-0 flex flex-col justify-between">
                {/* 1. Clean Circular Soundwave Voice Orb */}
                <VoiceVisualizerOrb
                  voiceState={voiceState}
                  audioVolume={audioVolume}
                  isAgentVolume={isAgentVolume}
                  isConnected={isConnected}
                />

                {/* 2. Spoken Captions stream (strictly output captions, zero typing) */}
                <div className="bg-amber-50/50 rounded-xl p-2 border border-amber-100/80 flex-1 min-h-[50px] max-h-[110px] overflow-y-auto my-1">
                  {transcripts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center h-full py-1">
                      <p className="text-[10px] text-stone-500">
                        {isConnected
                          ? 'Listening to you... Speak freely into your mic.'
                          : 'Tap Start Voice Call below to talk with Jewfren.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {transcripts.slice(-3).map((t) => (
                        <div
                          key={t.id}
                          className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`px-2 py-1 rounded-lg text-[11px] max-w-[92%] leading-relaxed ${
                              t.role === 'user'
                                ? 'bg-amber-500 text-white rounded-br-none'
                                : 'bg-white text-stone-800 border border-amber-200 rounded-bl-none shadow-2xs'
                            }`}
                          >
                            {t.text}
                          </div>
                        </div>
                      ))}
                      <div ref={transcriptsEndRef} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'moments' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <MediaGalleryModal
                  images={sharedImages}
                  onSendNewPhoto={() => setIsUploadModalOpen(true)}
                />
              </div>
            )}
          </div>

          {/* CALL CONTROLS DOCK (LOCKED AT BOTTOM) */}
          <div className="shrink-0 px-3 py-2.5 bg-gradient-to-t from-stone-50 to-white border-t border-amber-100">
            {!isConnected ? (
              // IDLE: BIG CALL PHONE BUTTON
              <button
                onClick={handleStartCall}
                disabled={isConnecting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 hover:from-emerald-600 hover:via-amber-600 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <Phone className="w-3.5 h-3.5 text-white animate-bounce" />
                </div>
                <span>{isConnecting ? 'Connecting...' : 'Start Voice Call'}</span>
              </button>
            ) : (
              // CONNECTED: END PHONE (HANG UP) + MIC MUTE + PHOTO
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handleToggleMute}
                  className={`flex-1 py-2 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                    isMuted
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-rose-600" />
                      <span>Unmute</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-stone-700" />
                      <span>Mute</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="py-2 px-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center gap-1 transition-all"
                  title="Share photo"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-700" />
                  <span>Photo</span>
                </button>

                {/* END PHONE HANGUP BUTTON */}
                <button
                  onClick={handleEndCall}
                  className="flex-1 py-2 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1"
                  title="Hang up call"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHOTO UPLOAD MODAL */}
      <ImageUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSendImage={handleSendImage}
        isConnected={isConnected}
      />
    </>
  );
};
