'use client';

import type { PipecatClient, TransportState } from '@pipecat-ai/client-js';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drives one web-widget voice call, start to finish.
 *
 * Flow: mint a session token from our own origin -> hand it to the Pipecat client, which posts
 * the WebRTC offer straight to the voice runtime with the token attached -> stream audio.
 *
 * There is no phone number, carrier, or telephony provider anywhere in this path. The token is
 * the only thing that names a tenant, and it is signed server-side, so the browser cannot claim
 * to be a different client or extend its own call.
 */

export type VoiceCallStatus =
  | 'idle'
  | 'requesting-mic'
  | 'connecting'
  | 'live'
  | 'ending'
  | 'error';

export type VoiceTranscriptLine = {
  id: string;
  role: 'customer' | 'agent';
  text: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SessionGrant = {
  sessionToken: string;
  voiceRuntimeUrl: string;
  iceServers: RTCIceServer[];
  expiresAt: number;
  maxDurationS: number;
};

type TrackedCall = {
  id: string;
};

type PersistedSpeaker = 'caller' | 'ai' | 'human';

const demoConsentVersion = 'pdpa-widget-v3';

/** Transport states that mean audio is actually flowing. */
const LIVE_STATES: TransportState[] = ['connected', 'ready'];

/**
 * The Pipecat client + WebRTC transport are ~110 kB, and most widget visitors only ever type.
 * Loading them on first call keeps the chat path light; the cost lands during the mic prompt,
 * where the visitor is already waiting on a dialog.
 */
async function loadVoiceSdk() {
  const [{ PipecatClient }, { SmallWebRTCTransport }] = await Promise.all([
    import('@pipecat-ai/client-js'),
    import('@pipecat-ai/small-webrtc-transport'),
  ]);
  return { PipecatClient, SmallWebRTCTransport };
}

function friendlyError(status: number, message?: string) {
  if (status === 404) return 'Voice calling is not available for this business yet.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status === 503) return message ?? 'All agents are busy right now. Please try again shortly.';
  return message ?? 'Could not start the call. Please try again.';
}

export function useVoiceCall(clientId: string, visitorId: string | null) {
  const [status, setStatus] = useState<VoiceCallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<VoiceTranscriptLine[]>([]);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const clientRef = useRef<PipecatClient | null>(null);
  const demoRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const demoActiveRef = useRef(false);
  const demoHelpShownRef = useRef(false);
  // The bot streams a reply token by token; we append into one line until it stops speaking.
  const agentLineRef = useRef<string | null>(null);
  const botTranscriptBufferRef = useRef('');
  const callIdRef = useRef<string | null>(null);
  const turnIndexRef = useRef(0);
  const finalizedRef = useRef(false);
  /**
   * The bot's voice needs somewhere to play. Neither PipecatClient nor SmallWebRTCTransport
   * creates an audio element or calls play() — the remote track just arrives on onTrackStarted
   * and is silent until something renders it. Without this, the call connects, the mic works,
   * transcripts flow, and the visitor hears nothing at all.
   */
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function ensureAudioElement() {
    if (audioRef.current !== null) return audioRef.current;
    const element = document.createElement('audio');
    element.autoplay = true;
    // Never show controls; this element exists only to make sound.
    element.style.display = 'none';
    document.body.appendChild(element);
    audioRef.current = element;
    return element;
  }

  function releaseAudioElement() {
    const element = audioRef.current;
    audioRef.current = null;
    if (element === null) return;
    element.srcObject = null;
    element.remove();
  }

  const startTrackedCall = useCallback(async (): Promise<TrackedCall | null> => {
    if (callIdRef.current !== null) return { id: callIdRef.current };
    const response = await fetch('/api/widget-voice/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, visitorId, consent: true }),
    });
    const data = (await response.json()) as { call?: TrackedCall; message?: string };
    if (!response.ok || data.call === undefined) {
      throw new Error(data.message ?? 'Could not start tracking this voice call.');
    }
    callIdRef.current = data.call.id;
    turnIndexRef.current = 0;
    finalizedRef.current = false;
    return data.call;
  }, [clientId, visitorId]);

  const persistVoiceTurn = useCallback(async (speaker: PersistedSpeaker, text: string, language = 'en') => {
    const trimmed = text.trim();
    const callId = callIdRef.current;
    if (callId === null || trimmed === '') return;
    const turnIndex = turnIndexRef.current;
    turnIndexRef.current += 1;
    try {
      const response = await fetch(`/api/widget-voice/calls/${encodeURIComponent(callId)}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, turnIndex, speaker, text: trimmed, language }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Voice turn was not saved.');
      }
    } catch (turnError) {
      console.warn('voice transcript tracking failed', turnError);
    }
  }, [clientId]);

  const finalizeTrackedCall = useCallback(async (
    status: 'ended' | 'failed' = 'ended',
    endReason = 'visitor_ended',
    outcome?: string,
  ) => {
    const callId = callIdRef.current;
    if (callId === null || finalizedRef.current) return;
    finalizedRef.current = true;
    try {
      const response = await fetch(`/api/widget-voice/calls/${encodeURIComponent(callId)}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, status, endReason, outcome }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Voice call was not closed.');
      }
    } catch (finalizeError) {
      console.warn('voice call finalization failed', finalizeError);
    } finally {
      callIdRef.current = null;
      botTranscriptBufferRef.current = '';
    }
  }, [clientId]);

  const teardown = useCallback(async () => {
    await finalizeTrackedCall('ended', 'widget_closed');
    demoActiveRef.current = false;
    demoHelpShownRef.current = false;
    const recognition = demoRecognitionRef.current;
    demoRecognitionRef.current = null;
    if (recognition !== null) {
      try {
        recognition.onend = null;
        recognition.abort();
      } catch {
        // Already stopped.
      }
    }
    window.speechSynthesis?.cancel();
    const client = clientRef.current;
    clientRef.current = null;
    agentLineRef.current = null;
    botTranscriptBufferRef.current = '';
    releaseAudioElement();
    if (client !== null) {
      try {
        await client.disconnect();
      } catch {
        // Already gone — nothing to clean up.
      }
    }
  }, [finalizeTrackedCall]);

  // Hanging up on unmount matters: a widget closed mid-call would otherwise keep burning
  // STT/LLM/TTS spend until the runtime's own duration cap fires.
  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  // Visible countdown so the cap is never a surprise mid-sentence.
  useEffect(() => {
    if (status !== 'live' || secondsLeft === null) return;
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => (current === null ? null : current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [status, secondsLeft]);

  const endCall = useCallback(async () => {
    setStatus('ending');
    await finalizeTrackedCall('ended', 'visitor_ended');
    await teardown();
    setStatus('idle');
    setIsAgentSpeaking(false);
    setSecondsLeft(null);
  }, [finalizeTrackedCall, teardown]);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onstart = () => setIsAgentSpeaking(true);
    utterance.onend = () => setIsAgentSpeaking(false);
    utterance.onerror = () => setIsAgentSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const sendDemoTurn = useCallback(async (text: string) => {
    if (visitorId === null) return;
    const messageId = `voice-demo:${visitorId}:${Date.now()}`;
    void persistVoiceTurn('caller', text);
    setTranscript((current) => [
      ...current,
      { id: `${messageId}:customer`, role: 'customer', text },
    ]);
    try {
      const response = await fetch('/api/web-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, visitorId, text, messageId, pdpaConsent: true, consentVersion: demoConsentVersion }),
      });
      const data = (await response.json()) as { reply?: { text: string }; error?: string };
      if (!response.ok || data.reply === undefined) {
        throw new Error(data.error ?? 'Unable to answer the voice demo.');
      }
      setTranscript((current) => [
        ...current,
        { id: `${messageId}:agent`, role: 'agent', text: data.reply.text },
      ]);
      void persistVoiceTurn('ai', data.reply.text);
      speak(data.reply.text);
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : 'The voice demo could not answer.');
    }
  }, [clientId, persistVoiceTurn, speak, visitorId]);

  const showDemoFallbackHelp = useCallback(() => {
    if (demoHelpShownRef.current) return;
    demoHelpShownRef.current = true;
    const helpText =
      'I am still here. If the browser does not transcribe your speech, type your message below and I will read the reply aloud.';
    setTranscript((current) => [
      ...current,
      { id: `demo-fallback-help-${Date.now()}`, role: 'agent', text: helpText },
    ]);
    speak(helpText);
  }, [speak]);

  const startBrowserVoiceDemo = useCallback(async () => {
    try {
      await startTrackedCall();
    } catch (trackError) {
      setStatus('error');
      setError(trackError instanceof Error ? trackError.message : 'Could not start tracking this voice call.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (SpeechRecognition === undefined) {
      await finalizeTrackedCall('failed', 'speech_recognition_unavailable');
      setStatus('error');
      setError('This browser cannot run the instant voice demo. Try Chrome, or use the text chat below.');
      return;
    }

    const greeting = 'Voice demo is ready. Speak now, or type below and I will read the answer aloud.';
    demoActiveRef.current = true;
    demoHelpShownRef.current = false;
    setStatus('live');
    setError(null);
    setSecondsLeft(120);
    setTranscript([{ id: `demo-agent-${Date.now()}`, role: 'agent', text: greeting }]);
    void persistVoiceTurn('ai', greeting);
    speak(greeting);

    const recognition = new SpeechRecognition();
    demoRecognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const turns: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const phrase = event.results[index]?.[0]?.transcript?.trim();
        if (phrase !== undefined && phrase !== '') turns.push(phrase);
      }
      const text = turns.join(' ').trim();
      if (text !== '') void sendDemoTurn(text);
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        demoActiveRef.current = false;
        void finalizeTrackedCall('failed', 'microphone_blocked');
        setStatus('error');
        setError('Microphone access is blocked. Allow it in your browser, then try again.');
        return;
      }
      setError(null);
      showDemoFallbackHelp();
    };
    recognition.onend = () => {
      if (!demoActiveRef.current) return;
      try {
        recognition.start();
      } catch {
        // Browsers can briefly reject a restart while the previous session closes.
      }
    };
    try {
      recognition.start();
    } catch {
      await finalizeTrackedCall('failed', 'speech_recognition_start_failed');
      setStatus('error');
      setError('The browser voice demo could not start. Try refreshing the page.');
    }
  }, [finalizeTrackedCall, persistVoiceTurn, sendDemoTurn, showDemoFallbackHelp, speak, startTrackedCall]);

  const startCall = useCallback(async () => {
    if (visitorId === null || clientRef.current !== null) return;
    setError(null);
    setTranscript([]);

    // Ask for the mic first. A denial here is the most common failure and deserves its own
    // message — "call failed" would send people hunting for a network problem.
    setStatus('requesting-mic');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setStatus('error');
      setError('Microphone access is needed for a voice call. Allow it in your browser, then try again.');
      return;
    }

    setStatus('connecting');
    try {
      await startTrackedCall();
    } catch (trackError) {
      setStatus('error');
      setError(trackError instanceof Error ? trackError.message : 'Could not start tracking this voice call.');
      return;
    }

    let grant: SessionGrant;
    try {
      const response = await fetch('/api/widget-voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, visitorId, consent: true }),
      });
      const data = (await response.json()) as Partial<SessionGrant> & { message?: string };
      if (!response.ok || data.sessionToken === undefined) {
        if (response.status === 503) {
          await startBrowserVoiceDemo();
          return;
        }
        throw new Error(friendlyError(response.status, data.message));
      }
      grant = data as SessionGrant;
    } catch (startError) {
      await finalizeTrackedCall('failed', 'session_mint_failed');
      setStatus('error');
      setError(startError instanceof Error ? startError.message : 'Could not start the call.');
      return;
    }

    let PipecatClientCtor: typeof PipecatClient;
    let SmallWebRTCTransportCtor: Awaited<ReturnType<typeof loadVoiceSdk>>['SmallWebRTCTransport'];
    try {
      ({ PipecatClient: PipecatClientCtor, SmallWebRTCTransport: SmallWebRTCTransportCtor } = await loadVoiceSdk());
    } catch {
      await finalizeTrackedCall('failed', 'voice_sdk_load_failed');
      setStatus('error');
      setError('Could not load the calling tools. Check your connection and try again.');
      return;
    }

    const transport = new SmallWebRTCTransportCtor({
      iceServers: grant.iceServers,
      // The token rides with the offer; the runtime reads the tenant out of it.
      webrtcRequestParams: {
        endpoint: new URL('/api/offer', grant.voiceRuntimeUrl).toString(),
        requestData: { sessionToken: grant.sessionToken },
      },
    });

    const client = new PipecatClientCtor({
      transport,
      enableMic: true,
      enableCam: false,
      callbacks: {
        onTransportStateChanged: (state) => {
          if (LIVE_STATES.includes(state)) {
            setStatus('live');
            setSecondsLeft(grant.maxDurationS);
          }
        },
        onUserTranscript: (data) => {
          // Interim results flicker; only commit finalized speech to the visible transcript.
          if (!data.final) return;
          setTranscript((current) => [
            ...current,
            { id: `user-${Date.now()}-${current.length}`, role: 'customer', text: data.text },
          ]);
          void persistVoiceTurn('caller', data.text);
        },
        onBotTranscript: (data) => {
          botTranscriptBufferRef.current = `${botTranscriptBufferRef.current}${data.text}`;
          setTranscript((current) => {
            const lineId = agentLineRef.current;
            if (lineId !== null) {
              return current.map((line) =>
                line.id === lineId ? { ...line, text: `${line.text}${data.text}` } : line,
              );
            }
            const id = `agent-${Date.now()}-${current.length}`;
            agentLineRef.current = id;
            return [...current, { id, role: 'agent', text: data.text }];
          });
        },
        onTrackStarted: (track, participant) => {
          // Only the bot's audio. The local mic track comes through here too; playing it back
          // would echo the visitor's own voice at them.
          if (participant?.local === true || track.kind !== 'audio') return;
          const element = ensureAudioElement();
          element.srcObject = new MediaStream([track]);
          // Autoplay can still be refused; the click that started the call usually satisfies the
          // gesture requirement, but log it rather than failing the call silently.
          void element.play().catch((playError) => {
            console.error('bot audio playback was blocked', playError);
            setError('Your browser blocked call audio. Check its sound permissions for this site.');
          });
        },
        onBotStartedSpeaking: () => setIsAgentSpeaking(true),
        onBotStoppedSpeaking: () => {
          setIsAgentSpeaking(false);
          void persistVoiceTurn('ai', botTranscriptBufferRef.current);
          botTranscriptBufferRef.current = '';
          agentLineRef.current = null; // next reply starts a fresh line
        },
        onDisconnected: () => {
          void finalizeTrackedCall('ended', 'runtime_disconnected');
          clientRef.current = null;
          setStatus('idle');
          setIsAgentSpeaking(false);
          setSecondsLeft(null);
        },
        onError: (message) => {
          void finalizeTrackedCall('failed', 'runtime_error');
          setStatus('error');
          setError('The call dropped. Please try again.');
          console.error('voice call error', message);
        },
      },
    });

    clientRef.current = client;
    try {
      await client.connect();
    } catch (connectError) {
      clientRef.current = null;
      await finalizeTrackedCall('failed', 'connect_failed');
      setStatus('error');
      // Almost always ICE failure on a restrictive network — i.e. TURN is missing or unreachable.
      setError('Could not connect the call. Check your network and try again.');
      console.error('voice connect failed', connectError);
    }
  }, [clientId, finalizeTrackedCall, persistVoiceTurn, startBrowserVoiceDemo, startTrackedCall, visitorId]);

  return {
    status,
    error,
    transcript,
    isAgentSpeaking,
    secondsLeft,
    startCall,
    endCall,
    speakText: speak,
    recordTurn: persistVoiceTurn,
  };
}
