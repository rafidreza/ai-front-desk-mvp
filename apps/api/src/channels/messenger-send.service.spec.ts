import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MessengerSendService } from './messenger-send.service';

describe('MessengerSendService (dry-run path)', () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
    delete process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.MESSENGER_PAGE_ACCESS_TOKEN;
    } else {
      process.env.MESSENGER_PAGE_ACCESS_TOKEN = originalToken;
    }
  });

  it('returns dry-run mode when no token is configured', async () => {
    const service = new MessengerSendService();
    const result = await service.sendText({ recipientId: 'customer-1', text: 'hello' });

    expect(result.mode).toBe('dry-run');
    expect(result.recipientId).toBe('customer-1');
    expect(result.text).toBe('hello');
  });

  it('treats empty token string the same as missing', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = '';
    const service = new MessengerSendService();
    const result = await service.sendText({ recipientId: 'customer-1', text: 'hi' });

    expect(result.mode).toBe('dry-run');
  });
});
