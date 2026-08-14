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
  // The bot streams a reply token by token; we append into one line until it stops speaking.
  const agentLineRef = useRef<string | null>(null);
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

  const teardown = useCallback(async () => {
    demoActiveRef.current = false;
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
    releaseAudioElement();
    if (client !== null) {
      try {
        await client.disconnect();
      } catch {
        // Already gone — nothing to clean up.
      }
    }
  }, []);

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
    await teardown();
    setStatus('idle');
    setIsAgentSpeaking(false);
    setSecondsLeft(null);
  }, [teardown]);

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
      speak(data.reply.text);
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : 'The voice demo could not answer.');
    }
  }, [clientId, speak, visitorId]);

  const startBrowserVoiceDemo = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (SpeechRecognition === undefined) {
      setStatus('error');
      setError('This browser cannot run the instant voice demo. Try Chrome, or use the text chat below.');
      return;
    }

    const greeting = 'Voice demo is ready. Tell me what your customer needs help with.';
    demoActiveRef.current = true;
    setStatus('live');
    setSecondsLeft(120);
    setTranscript([{ id: `demo-agent-${Date.now()}`, role: 'agent', text: greeting }]);
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
      setError('The browser voice demo had trouble hearing you. You can keep typing in chat.');
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
      setStatus('error');
      setError('The browser voice demo could not start. Try refreshing the page.');
    }
  }, [sendDemoTurn, speak]);

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
      setStatus('error');
      setError(startError instanceof Error ? startError.message : 'Could not start the call.');
      return;
    }

    let PipecatClientCtor: typeof PipecatClient;
    let SmallWebRTCTransportCtor: Awaited<ReturnType<typeof loadVoiceSdk>>['SmallWebRTCTransport'];
    try {
      ({ PipecatClient: PipecatClientCtor, SmallWebRTCTransport: SmallWebRTCTransportCtor } = await loadVoiceSdk());
    } catch {
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
        },
        onBotTranscript: (data) => {
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
          agentLineRef.current = null; // next reply starts a fresh line
        },
        onDisconnected: () => {
          clientRef.current = null;
          setStatus('idle');
          setIsAgentSpeaking(false);
          setSecondsLeft(null);
        },
        onError: (message) => {
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
      setStatus('error');
      // Almost always ICE failure on a restrictive network — i.e. TURN is missing or unreachable.
      setError('Could not connect the call. Check your network and try again.');
      console.error('voice connect failed', connectError);
    }
  }, [clientId, startBrowserVoiceDemo, visitorId]);

  return { status, error, transcript, isAgentSpeaking, secondsLeft, startCall, endCall };
}
