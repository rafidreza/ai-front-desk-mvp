function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
}

function getApiToken() {
  const token = process.env.INTERNAL_API_TOKEN;
  if (process.env.NODE_ENV === 'production' && (token === undefined || token.length < 32)) {
    throw new Error('INTERNAL_API_TOKEN must be set to at least 32 characters in production.');
  }
  return token ?? 'dev-internal-api-token-only-for-local-work';
}

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(path, getApiBaseUrl()), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiToken()}`,
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const body = await response.text();
  const data = body === '' ? null : JSON.parse(body);

  if (!response.ok) {
    const message = data !== null && typeof data === 'object' && 'message' in data ? String(data.message) : 'Backend request failed.';
    throw new Error(message);
  }

  return data as T;
}
