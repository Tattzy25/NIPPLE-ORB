import { CallStatus, VoiceState, TranscriptItem } from '../types';

export interface RealtimeWebRTCOptions {
  onCallStatusChange: (status: CallStatus, errorMsg?: string) => void;
  onVoiceStateChange: (state: VoiceState) => void;
  onTranscript: (transcript: TranscriptItem) => void;
  onAudioVolume: (volume: number, isAgent: boolean) => void;
  onAgentAction?: (data: any) => void;
}

export class RealtimeWebRTCClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private agentAnalyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private currentAssistantTranscriptId: string | null = null;
  private assistantAccumulatedText: string = '';
  private isMuted: boolean = false;
  private options: RealtimeWebRTCOptions;

  constructor(options: RealtimeWebRTCOptions) {
    this.options = options;
  }

  public updateOptions(options: Partial<RealtimeWebRTCOptions>) {
    this.options = { ...this.options, ...options };
  }

  public async startCall(): Promise<void> {
    try {
      this.options.onCallStatusChange('connecting');

      // 1. Request microphone access
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.localStream = micStream;
      } catch (micErr: any) {
        throw new Error(
          micErr.name === 'NotAllowedError'
            ? 'Microphone permission was denied. Please allow microphone access to talk to Jewfren.'
            : `Microphone access error: ${micErr.message}`
        );
      }

      // 2. Request ephemeral client secret from server endpoint
      // NO API KEYS in request body or headers - server strictly reads process.env.OPENAI_API_KEY
      const res = await fetch('/api/realtime-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const sessionData = await res.json();

      if (!res.ok || !sessionData.ok) {
        throw new Error(sessionData.error || 'Failed to start voice call session with server.');
      }

      const ephemeralKey = sessionData.ephemeralKey;
      if (!ephemeralKey) {
        throw new Error('Server returned an empty ephemeral client key.');
      }

      // 3. Initialize WebRTC Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      this.pc = pc;

      // 4. Remote audio playback element
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      this.remoteAudio = audioEl;

      // 5. Audio Context and Analysers for voice visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          const micSource = this.audioContext.createMediaStreamSource(micStream);
          this.micAnalyser = this.audioContext.createAnalyser();
          this.micAnalyser.fftSize = 64;
          micSource.connect(this.micAnalyser);
        }
      } catch (e) {
        console.warn('AudioContext setup:', e);
      }

      // 6. Handle remote incoming agent audio track
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch((err) => {
          console.error('Audio playback error:', err);
        });

        if (this.audioContext) {
          try {
            const agentSource = this.audioContext.createMediaStreamSource(event.streams[0]);
            this.agentAnalyser = this.audioContext.createAnalyser();
            this.agentAnalyser.fftSize = 64;
            agentSource.connect(this.agentAnalyser);
          } catch (e) {
            console.warn('Agent analyser connection:', e);
          }
        }
      };

      // 7. Add local microphone audio track to WebRTC
      micStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, micStream);
      });

      // 8. Create Data Channel for realtime events
      const dc = pc.createDataChannel('oai-events');
      this.dc = dc;

      dc.onopen = () => {
        console.log('[Jewfren Realtime] Live WebRTC data channel established');
      };

      dc.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleRealtimeEvent(message);
        } catch (err) {
          console.error('Error handling realtime event:', err);
        }
      };

      // 9. Create Offer and Set Local Description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 10. Exchange SDP with OpenAI Realtime WebRTC Gateway
      // The session configuration and transcription model are already locked into the ephemeralKey
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`OpenAI Realtime WebRTC connection error: ${errorText || sdpResponse.statusText}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: answerSdp,
      };

      await pc.setRemoteDescription(answer);

      // 11. Start animation loop for audio visualizer
      this.startAudioVisualizerLoop();

      this.options.onCallStatusChange('connected');
      this.options.onVoiceStateChange('idle');
    } catch (error: any) {
      this.endCall();
      this.options.onCallStatusChange('error', error?.message || 'Could not connect live call.');
    }
  }

  private handleRealtimeEvent(event: any) {
    const type = event.type;

    switch (type) {
      case 'input_audio_buffer.speech_started':
        this.options.onVoiceStateChange('listening');
        break;

      case 'input_audio_buffer.speech_stopped':
        this.options.onVoiceStateChange('processing');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          this.options.onTranscript({
            id: event.item_id || Math.random().toString(36).substring(7),
            role: 'user',
            text: event.transcript,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPartial: false,
          });
        }
        break;

      case 'response.created':
        this.currentAssistantTranscriptId = Math.random().toString(36).substring(7);
        this.assistantAccumulatedText = '';
        this.options.onVoiceStateChange('speaking');
        break;

      case 'response.audio_transcript.delta':
        if (event.delta) {
          this.assistantAccumulatedText += event.delta;
          this.options.onTranscript({
            id: this.currentAssistantTranscriptId || 'temp-assistant',
            role: 'assistant',
            text: this.assistantAccumulatedText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPartial: true,
          });
        }
        break;

      case 'response.audio_transcript.done':
        if (event.transcript || this.assistantAccumulatedText) {
          const finalText = event.transcript || this.assistantAccumulatedText;
          this.options.onTranscript({
            id: this.currentAssistantTranscriptId || 'temp-assistant',
            role: 'assistant',
            text: finalText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPartial: false,
          });
        }
        break;

      case 'response.done':
        this.options.onVoiceStateChange('idle');
        break;

      case 'error':
        if (event.error?.message) {
          this.options.onCallStatusChange('connected', event.error.message);
        }
        break;

      default:
        if (this.options.onAgentAction) {
          this.options.onAgentAction(event);
        }
        break;
    }
  }

  private startAudioVisualizerLoop() {
    const micDataArray = new Uint8Array(32);
    const agentDataArray = new Uint8Array(32);

    const update = () => {
      let micVol = 0;
      let agentVol = 0;

      if (this.micAnalyser && !this.isMuted) {
        this.micAnalyser.getByteFrequencyData(micDataArray);
        let sum = 0;
        for (let i = 0; i < micDataArray.length; i++) {
          sum += micDataArray[i];
        }
        micVol = sum / (micDataArray.length * 255);
      }

      if (this.agentAnalyser) {
        this.agentAnalyser.getByteFrequencyData(agentDataArray);
        let sum = 0;
        for (let i = 0; i < agentDataArray.length; i++) {
          sum += agentDataArray[i];
        }
        agentVol = sum / (agentDataArray.length * 255);
      }

      if (agentVol > 0.04) {
        this.options.onAudioVolume(Math.min(1, agentVol * 1.6), true);
      } else if (micVol > 0.04) {
        this.options.onAudioVolume(Math.min(1, micVol * 1.5), false);
      } else {
        this.options.onAudioVolume(0, false);
      }

      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  // Send an image directly to the live Realtime session
  public async sendImage(base64DataUrl: string, captionText?: string): Promise<boolean> {
    if (!this.dc || this.dc.readyState !== 'open') {
      return false;
    }

    try {
      const itemEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: captionText || "Here is a photo I'm sharing with you.",
            },
            {
              type: 'input_image',
              image_url: base64DataUrl,
            },
          ],
        },
      };
      this.dc.send(JSON.stringify(itemEvent));

      const responseCreateEvent = {
        type: 'response.create',
        response: {
          modalities: ['audio'],
        },
      };
      this.dc.send(JSON.stringify(responseCreateEvent));

      return true;
    } catch (err) {
      console.error('Failed to send image to Realtime session:', err);
      return false;
    }
  }

  public toggleMute(): boolean {
    if (!this.localStream) return this.isMuted;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public endCall(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.dc) {
      try {
        this.dc.close();
      } catch (e) {}
      this.dc = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.micAnalyser = null;
    this.agentAnalyser = null;
    this.currentAssistantTranscriptId = null;
    this.assistantAccumulatedText = '';
    this.isMuted = false;

    this.options.onCallStatusChange('idle');
    this.options.onVoiceStateChange('idle');
    this.options.onAudioVolume(0, false);
  }
}
