export function decodeBase64(input: string) {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function decodeBase64Text(input: string) {
  return new TextDecoder('utf-8', { fatal: false }).decode(decodeBase64(input));
}
