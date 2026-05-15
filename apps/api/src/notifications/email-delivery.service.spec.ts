import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailDeliveryService } from './email-delivery.service';

describe('EmailDeliveryService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('dry-runs when Postmark credentials are missing', async () => {
    delete process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.EMAIL_FROM_ADDRESS;
    const service = new EmailDeliveryService();

    const result = await service.sendEmail({
      to: 'owner@example.com',
      subject: 'Daily digest',
      textBody: 'Hello',
    });

    expect(result).toMatchObject({ mode: 'dry-run', provider: 'postmark', to: 'owner@example.com' });
  });

  it('sends through Postmark when credentials exist', async () => {
    process.env.POSTMARK_SERVER_TOKEN = 'postmark-token';
    process.env.EMAIL_FROM_ADDRESS = 'support@example.com';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ MessageID: 'message-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new EmailDeliveryService();

    const result = await service.sendEmail({
      to: 'owner@example.com',
      subject: 'Daily digest',
      textBody: 'Hello',
      tag: 'daily-digest',
    });

    expect(result).toMatchObject({ mode: 'sent', providerMessageId: 'message-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postmarkapp.com/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Postmark-Server-Token': 'postmark-token' }),
      }),
    );
  });
});
