import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelSendService, normalizeWhatsappRecipient } from './channel-send.service';

describe('ChannelSendService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('normalizes Bangladesh WhatsApp recipients', () => {
    expect(normalizeWhatsappRecipient('+8801712345678')).toBe('8801712345678');
    expect(normalizeWhatsappRecipient('01712345678')).toBe('8801712345678');
    expect(normalizeWhatsappRecipient('008801712345678')).toBe('8801712345678');
  });

  it('dry-runs Messenger and WhatsApp sends when credentials are missing', async () => {
    delete process.env.MESSENGER_PAGE_ACCESS_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const service = new ChannelSendService();

    await expect(service.sendText({ channel: 'messenger', recipientId: 'customer-1', text: 'hello' })).resolves.toMatchObject({
      mode: 'dry-run',
      channel: 'messenger',
    });
    await expect(service.sendText({ channel: 'whatsapp', recipientId: '+8801712345678', text: 'hello' })).resolves.toMatchObject({
      mode: 'dry-run',
      channel: 'whatsapp',
      recipientId: '8801712345678',
    });
  });

  it('sends WhatsApp text through Cloud API when credentials exist', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-number-id';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new ChannelSendService();

    const result = await service.sendText({ channel: 'whatsapp', recipientId: '+8801712345678', text: 'hello' });

    expect(result).toMatchObject({ mode: 'sent', channel: 'whatsapp', recipientId: '8801712345678' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/phone-number-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('sends Messenger text through Graph API when credentials exist', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = 'page-token';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new ChannelSendService();

    const result = await service.sendText({ channel: 'messenger', recipientId: 'customer-1', text: 'hello' });

    expect(result).toMatchObject({ mode: 'sent', channel: 'messenger', recipientId: 'customer-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/me/messages',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('page-token'),
      }),
    );
  });
});
