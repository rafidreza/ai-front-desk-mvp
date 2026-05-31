export interface MessengerHistoryCandidate {
  title: string;
  answer: string;
  keywords: string[];
}

interface RawMessengerMessage {
  senderName: string;
  content: string;
  timestampMs?: number;
}

const maxCandidates = 30;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

function stringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function nestedName(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const nested = asRecord(record[key]);
    if (nested === undefined) continue;
    const name = stringField(nested, ['name', 'full_name', 'title']);
    if (name !== undefined) return name;
  }
  return undefined;
}

function numberField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeMessage(value: unknown): RawMessengerMessage | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;

  const content = stringField(record, ['content', 'text', 'message', 'body']);
  if (content === undefined || isExportNoise(content)) return undefined;

  const senderName =
    stringField(record, ['sender_name', 'senderName', 'sender', 'author', 'from_name']) ??
    nestedName(record, ['sender', 'from', 'author']) ??
    'unknown';

  return {
    senderName,
    content,
    timestampMs: numberField(record, ['timestamp_ms', 'timestampMs', 'timestamp']),
  };
}

function isExportNoise(content: string) {
  const normalized = content.toLowerCase();
  return (
    normalized.includes('sent an attachment') ||
    normalized.includes('sent a photo') ||
    normalized.includes('liked a message') ||
    normalized.includes('missed audio call') ||
    normalized.includes('started a video chat')
  );
}

function collectMessageThreads(value: unknown, depth = 0): RawMessengerMessage[][] {
  if (depth > 5) return [];

  if (Array.isArray(value)) {
    const directMessages = value.map(normalizeMessage).filter((message): message is RawMessengerMessage => message !== undefined);
    if (directMessages.length >= 2) return [sortMessages(directMessages)];
    return value.flatMap((item) => collectMessageThreads(item, depth + 1));
  }

  const record = asRecord(value);
  if (record === undefined) return [];

  if (Array.isArray(record.messages)) {
    const messages = record.messages
      .map(normalizeMessage)
      .filter((message): message is RawMessengerMessage => message !== undefined);
    if (messages.length >= 2) return [sortMessages(messages)];
  }

  return Object.values(record).flatMap((item) => collectMessageThreads(item, depth + 1));
}

function sortMessages(messages: RawMessengerMessage[]) {
  if (messages.every((message) => message.timestampMs !== undefined)) {
    return [...messages].sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));
  }
  return messages;
}

function cleanInline(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function looksLikeCustomerQuestion(text: string) {
  const normalized = text.toLowerCase();
  return (
    /[?？]|\b(price|delivery|return|refund|stock|size|available|order|charge|koto|ase|hobe)\b/u.test(normalized) ||
    /কত|কবে|আছে|হবে|ডেলিভারি|রিটার্ন|রিফান্ড|সাইজ|অর্ডার/u.test(normalized)
  );
}

function isUsefulPair(question: RawMessengerMessage, answer: RawMessengerMessage) {
  if (question.senderName === answer.senderName) return false;
  if (question.content.length < 4 || answer.content.length < 8) return false;
  if (answer.content.length > 1600) return false;
  return looksLikeCustomerQuestion(question.content) || question.content.length <= 220;
}

function extractKeywords(text: string) {
  const stopWords = new Set([
    'about',
    'after',
    'answer',
    'customer',
    'delivery',
    'from',
    'have',
    'into',
    'that',
    'their',
    'there',
    'this',
    'with',
    'your',
    'আপনার',
    'আমরা',
    'এবং',
    'করা',
    'জন্য',
    'থেকে',
    'হবে',
  ]);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) ?? [];
  const unique = Array.from(new Set(tokens.filter((token) => !stopWords.has(token))));
  return unique.slice(0, 8).length > 0 ? unique.slice(0, 8) : ['messenger'];
}

export function extractMessengerHistoryCandidates(text: string): MessengerHistoryCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const candidates: MessengerHistoryCandidate[] = [];
  const seen = new Set<string>();

  for (const thread of collectMessageThreads(parsed)) {
    const firstSender = thread[0]?.senderName;
    for (let index = 0; index < thread.length - 1; index += 1) {
      const question = thread[index]!;
      const answer = thread[index + 1]!;
      const previous = thread[index - 1];
      if (
        previous !== undefined &&
        firstSender !== undefined &&
        question.senderName !== firstSender &&
        previous.senderName === answer.senderName &&
        previous.senderName !== question.senderName
      ) {
        continue;
      }
      if (!isUsefulPair(question, answer)) continue;

      const title = truncate(cleanInline(question.content), 90);
      const candidateAnswer = truncate(cleanInline(answer.content), 1200);
      const key = `${title.toLowerCase()}::${candidateAnswer.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        title,
        answer: candidateAnswer,
        keywords: extractKeywords(`${title} ${candidateAnswer}`),
      });
      if (candidates.length >= maxCandidates) return candidates;
    }
  }

  return candidates;
}
