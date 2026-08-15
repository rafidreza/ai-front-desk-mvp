import { NextRequest, NextResponse } from 'next/server';

const maxTextLength = 1500;

function cleanText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxTextLength);
}

function supportsAudioTags(modelId: string) {
  return modelId.toLowerCase().includes('v3');
}

function expressiveTextForElevenV3(text: string) {
  if (/^\s*\[[^\]]+\]/.test(text)) return text;
  const hasBangla = /[\u0980-\u09ff]/.test(text);
  const isBanglaPriceAnswer = hasBangla && /[\d\u09e6-\u09ef]|mbps|gbps|bdt|\u09f3/i.test(text);
  const isPriceAnswer = /\b(bdt|tk|taka|price|package|plan)\b/i.test(text) || isBanglaPriceAnswer;
  const isApology = /\b(sorry|apolog|unavailable|cannot|can't|not sure)\b/i.test(text);
  const isEscalation = /\b(ticket|human|team|check|update|escalat|handoff)\b/i.test(text);

  if (isApology) return `[apologetically] ${text}`;
  if (isEscalation) return `[reassuringly] ${text}`;
  if (isPriceAnswer) return `[clearly] ${text}`;
  if (hasBangla) return `[warmly] ${text}`;
  return `[warmly] ${text}`;
}

export async function POST(request: NextRequest) {
  let text = '';
  try {
    const payload = (await request.json()) as { text?: unknown };
    text = cleanText(payload.text);
  } catch {
    return NextResponse.json({ message: 'Invalid TTS request.' }, { status: 400 });
  }

  if (text === '') {
    return NextResponse.json({ message: 'Text is required.' }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_TTS_MODEL ?? process.env.TTS_MODEL ?? 'eleven_v3';

  if (apiKey === undefined || apiKey === '' || voiceId === undefined || voiceId === '') {
    return NextResponse.json({ message: 'ElevenLabs voice is not configured.' }, { status: 503 });
  }

  try {
    const ttsText = supportsAudioTags(modelId) ? expressiveTextForElevenV3(text) : text;
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: ttsText,
          model_id: modelId,
        }),
        cache: 'no-store',
      },
    );

    if (!elevenLabsResponse.ok) {
      return NextResponse.json({ message: 'ElevenLabs voice is unavailable right now.' }, { status: 502 });
    }

    return new NextResponse(await elevenLabsResponse.arrayBuffer(), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': elevenLabsResponse.headers.get('content-type') ?? 'audio/mpeg',
      },
    });
  } catch {
    return NextResponse.json({ message: 'ElevenLabs voice is unavailable right now.' }, { status: 502 });
  }
}
