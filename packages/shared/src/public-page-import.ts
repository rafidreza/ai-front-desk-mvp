const entityMap: Record<string, string> = {
  amp: '&',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  apos: "'",
};

function decodeEntity(entity: string) {
  if (entity.startsWith('#x')) {
    const value = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(value) ? String.fromCodePoint(value) : `&${entity};`;
  }
  if (entity.startsWith('#')) {
    const value = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(value) ? String.fromCodePoint(value) : `&${entity};`;
  }
  return entityMap[entity] ?? `&${entity};`;
}

export function extractReadablePageText(raw: string) {
  return raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);/g, (_match, entity: string) => decodeEntity(entity))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
