import { Channel, CustomerHistory } from '@/types/domain';

const apiBaseUrl = '/api/backend';

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getCustomerHistory(input: {
  clientId: string;
  channel?: Channel;
  externalSenderId?: string;
  phone?: string;
  email?: string;
}): Promise<CustomerHistory> {
  const params = new URLSearchParams();
  if (input.channel !== undefined) params.set('channel', input.channel);
  if (input.externalSenderId !== undefined) params.set('externalSenderId', input.externalSenderId);
  if (input.phone !== undefined) params.set('phone', input.phone);
  if (input.email !== undefined) params.set('email', input.email);
  const data = await apiFetch<{ history: CustomerHistory }>(
    `/clients/${input.clientId}/customer-history?${params.toString()}`,
  );
  return data.history;
}
