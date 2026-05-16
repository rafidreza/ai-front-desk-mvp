import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WhatsAppSignatureService } from './whatsapp-signature.service';

describe('WhatsAppSignatureService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('skips verification when no app secret is configured in local mode', () => {
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.MESSENGER_APP_SECRET;
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    expect(new WhatsAppSignatureService().verify({})).toEqual({ mode: 'skipped' });
  });

  it('verifies a valid WhatsApp signature', () => {
    process.env.WHATSAPP_APP_SECRET = 'whatsapp-secret';
    const rawBody = Buffer.from('{"hello":"world"}');
    const signature = `sha256=${createHmac('sha256', 'whatsapp-secret').update(rawBody).digest('hex')}`;

    expect(new WhatsAppSignatureService().verify({ signature, rawBody })).toEqual({ mode: 'verified' });
  });

  it('rejects invalid signatures', () => {
    process.env.WHATSAPP_APP_SECRET = 'whatsapp-secret';

    expect(() =>
      new WhatsAppSignatureService().verify({
        signature: 'sha256=bad',
        rawBody: Buffer.from('{"hello":"world"}'),
      }),
    ).toThrow(UnauthorizedException);
  });
});
