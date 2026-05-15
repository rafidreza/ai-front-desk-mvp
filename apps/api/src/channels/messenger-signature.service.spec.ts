import { createHmac } from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { MessengerSignatureService } from './messenger-signature.service';

describe('MessengerSignatureService', () => {
  const originalSecret = process.env.MESSENGER_APP_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableMessenger = process.env.ENABLE_MESSENGER;

  afterEach(() => {
    process.env.MESSENGER_APP_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENABLE_MESSENGER = originalEnableMessenger;
  });

  it('skips verification in local mode when no app secret is configured', () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_MESSENGER = 'false';
    delete process.env.MESSENGER_APP_SECRET;

    const service = new MessengerSignatureService();

    expect(service.verify({ rawBody: Buffer.from('{}') })).toEqual({ mode: 'skipped' });
  });

  it('verifies a valid Messenger signature when app secret is configured', () => {
    process.env.MESSENGER_APP_SECRET = 'test-secret';
    const body = Buffer.from('{"object":"page"}');
    const signature = `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`;
    const service = new MessengerSignatureService();

    expect(service.verify({ signature, rawBody: body })).toEqual({ mode: 'verified' });
  });

  it('rejects an invalid Messenger signature', () => {
    process.env.MESSENGER_APP_SECRET = 'test-secret';
    const service = new MessengerSignatureService();

    expect(() => service.verify({ signature: 'sha256=bad', rawBody: Buffer.from('{}') })).toThrow(
      'Invalid Messenger signature.',
    );
  });
});
