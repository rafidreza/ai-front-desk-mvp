#!/usr/bin/env node
/**
 * Load a client's knowledge base from a JSON file into the running API.
 *
 * Why this exists: entries created through the API land in `draft`, but the voice agent only
 * reads `active` ones. Loading 30 answers and then finding the agent still knows nothing is an
 * easy and very confusing mistake — this script creates each entry AND activates it, then reads
 * the active list back so you can see what the agent will actually use.
 *
 * Usage:
 *   node scripts/load-kb.mjs scripts/kb-template.json
 *   API_BASE_URL=http://localhost:4000 node scripts/load-kb.mjs my-client-kb.json
 *
 * The internal token is read from apps/hono-api/.dev.vars unless INTERNAL_API_TOKEN is set.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';

// Must match the fallback in apps/hono-api/src/env.ts — an empty INTERNAL_API_TOKEN in
// .dev.vars means the API is running on this dev default, not that auth is disabled.
const DEV_FALLBACK_TOKEN = 'dev-internal-api-token-only-for-local-work';

function internalToken() {
  if (process.env.INTERNAL_API_TOKEN) return process.env.INTERNAL_API_TOKEN;
  try {
    const vars = readFileSync(resolve(repoRoot, 'apps/hono-api/.dev.vars'), 'utf8');
    const match = vars.match(/^INTERNAL_API_TOKEN=(.*)$/m);
    const value = match?.[1].trim();
    if (value) return value;
  } catch {
    // no .dev.vars — fall through
  }
  console.log('INTERNAL_API_TOKEN is unset/empty; using the local dev fallback token.');
  return DEV_FALLBACK_TOKEN;
}

const token = internalToken();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(method, path, body) {
  const response = await fetch(new URL(path, apiBase), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 200)}`);
  return text === '' ? {} : JSON.parse(text);
}

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/load-kb.mjs <kb.json>');
  process.exit(1);
}

const spec = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
const { clientId, entries = [] } = spec;
if (!clientId) throw new Error('kb file needs a "clientId"');
if (entries.length === 0) throw new Error('kb file has no entries');

console.log(`Loading ${entries.length} entries for ${clientId} via ${apiBase}\n`);

let loaded = 0;
for (const entry of entries) {
  const label = (entry.title ?? '(untitled)').slice(0, 44).padEnd(44);
  try {
    const created = await api('POST', `/clients/${clientId}/knowledge`, {
      title: entry.title,
      answer: entry.answer,
      keywords: entry.keywords?.length ? entry.keywords : [entry.title],
      category: entry.category,
      actorId: 'kb-loader',
    });
    const id = created.entry?.id ?? created.id;
    if (!id) throw new Error(`no entry id in response: ${JSON.stringify(created).slice(0, 120)}`);
    // Entries are born as drafts; the voice agent reads only `active`.
    await api('PATCH', `/clients/${clientId}/knowledge/${id}/status`, { status: 'active', actorId: 'kb-loader' });
    console.log(`  ok    ${label} ${id}`);
    loaded += 1;
  } catch (error) {
    console.log(`  FAIL  ${label} ${error.message}`);
  }
}

// Read back exactly what the voice agent will see — the only check that matters.
const live = await api('GET', `/voice/clients/${clientId}/knowledge`);
const active = live.entries ?? [];
console.log(`\nLoaded ${loaded}/${entries.length}. Agent now sees ${active.length} active entries:`);
for (const entry of active) console.log(`  - ${entry.title}`);

if (active.length === 0) {
  console.log('\nAgent sees NOTHING. It will fall back to the hardcoded demo persona.');
  process.exit(1);
}

// Digits inside Bangla text are read aloud incorrectly (1500 -> 500), so flag them here rather
// than letting a wrong price reach a customer. See voice-agent/persona.py.
const risky = active.filter((e) => /[ঀ-৿]/.test(e.answer ?? '') && /[0-9০-৯]/.test(e.answer ?? ''));
if (risky.length > 0) {
  console.log('\nWARNING — digits inside Bangla answers will be MISPRONOUNCED (1500 is read as 500).');
  console.log('Rewrite the numbers as Bangla words (পনেরোশো, পঁচিশশো, তিন হাজার):');
  for (const entry of risky) console.log(`  - ${entry.title}`);
}
