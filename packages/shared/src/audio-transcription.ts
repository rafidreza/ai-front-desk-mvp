export interface VoiceTranscriptionInput {
  attachmentUrl?: string;
  openAiApiKey?: string;
  model?: string;
  prompt?: string;
  whatsAppAccessToken?: string;
  graphVersion?: string;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
}

export type VoiceTranscriptionResult =
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }
  | { status: 'transcribed'; transcript: string };

const defaultModel = 'gpt-4o-mini-transcribe';
const defaultMaxBytes = 25 * 1024 * 1024;

function extensionFromContentType(contentType: string) {
  if (contentType.includes('mpeg')) return 'mp3';
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('m4a')) return 'm4a';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('ogg')) return 'ogg';
  return 'webm';
}

async function resolveWhatsAppMedia(input: {
  mediaId: string;
  token?: string;
  graphVersion?: string;
  fetcher: typeof fetch;
}) {
  if (input.token === undefined || input.token.trim() === '') {
    throw new Error('WHATSAPP_ACCESS_TOKEN is required to fetch WhatsApp voice media.');
  }
  const graphVersion = input.graphVersion ?? 'v20.0';
  const mediaResponse = await input.fetcher(`https://graph.facebook.com/${graphVersion}/${input.mediaId}`, {
    headers: { Authorization: `Bearer ${input.token}` },
  });
  if (!mediaResponse.ok) throw new Error(`WhatsApp media lookup failed: ${mediaResponse.status}`);
  const media = (await mediaResponse.json()) as { url?: string; mime_type?: string };
  if (media.url === undefined) throw new Error('WhatsApp media lookup did not return a download URL.');
  return { url: media.url, contentType: media.mime_type };
}

async function fetchAudio(input: VoiceTranscriptionInput & { fetcher: typeof fetch }) {
  if (input.attachmentUrl === undefined || input.attachmentUrl.trim() === '') {
    throw new Error('Voice attachment URL is missing.');
  }

  let mediaUrl = input.attachmentUrl;
  let expectedContentType: string | undefined;
  let headers: HeadersInit | undefined;

  if (mediaUrl.startsWith('whatsapp-media:')) {
    const media = await resolveWhatsAppMedia({
      mediaId: mediaUrl.replace('whatsapp-media:', ''),
      token: input.whatsAppAccessToken,
      graphVersion: input.graphVersion,
      fetcher: input.fetcher,
    });
    mediaUrl = media.url;
    expectedContentType = media.contentType;
    headers = input.whatsAppAccessToken === undefined ? undefined : { Authorization: `Bearer ${input.whatsAppAccessToken}` };
  }

  const response = await input.fetcher(mediaUrl, { headers });
  if (!response.ok) throw new Error(`Voice media fetch failed: ${response.status}`);
  const contentType = response.headers.get('content-type') ?? expectedContentType ?? 'audio/webm';
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('Voice media file is empty.');
  if (bytes.byteLength > (input.maxBytes ?? defaultMaxBytes)) {
    throw new Error('Voice media file is larger than the transcription limit.');
  }

  return { bytes, contentType };
}

export async function transcribeVoiceAttachment(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult> {
  if (input.openAiApiKey === undefined || input.openAiApiKey.trim() === '') {
    return { status: 'skipped', reason: 'OPENAI_API_KEY is not configured.' };
  }
  if (input.attachmentUrl === undefined || input.attachmentUrl.trim() === '') {
    return { status: 'skipped', reason: 'Voice attachment URL is missing.' };
  }

  const fetcher = input.fetchImpl ?? fetch;

  try {
    const audio = await fetchAudio({ ...input, fetcher });
    const form = new FormData();
    const extension = extensionFromContentType(audio.contentType);
    form.set('model', input.model ?? defaultModel);
    form.set('response_format', 'json');
    if (input.prompt !== undefined && input.prompt.trim() !== '') {
      form.set('prompt', input.prompt.trim());
    }
    form.set('file', new Blob([audio.bytes], { type: audio.contentType }), `voice-note.${extension}`);

    const response = await fetcher('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.openAiApiKey}` },
      body: form,
    });
    if (!response.ok) return { status: 'failed', reason: `Transcription failed: ${response.status}` };

    const data = (await response.json()) as { text?: string };
    const transcript = data.text?.trim();
    if (transcript === undefined || transcript === '') {
      return { status: 'failed', reason: 'Transcription response did not include text.' };
    }
    return { status: 'transcribed', transcript };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'Unknown transcription failure.' };
  }
}
