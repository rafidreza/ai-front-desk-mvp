import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class WhatsAppSignatureService {
  verify(input: { signature?: string; rawBody?: Buffer }): { mode: 'skipped' | 'verified' } {
    const appSecret = process.env.WHATSAPP_APP_SECRET ?? process.env.MESSENGER_APP_SECRET;
    const hasSecret = appSecret !== undefined && appSecret !== '';
    const shouldEnforce =
      process.env.NODE_ENV === 'production' ||
      process.env.ENABLE_WHATSAPP === 'true' ||
      (process.env.WHATSAPP_ACCESS_TOKEN ?? '') !== '';

    if (!hasSecret) {
      if (shouldEnforce) {
        throw new UnauthorizedException('WhatsApp app secret is required for signature verification.');
      }

      return { mode: 'skipped' };
    }

    if (input.signature === undefined || input.rawBody === undefined) {
      throw new UnauthorizedException('Missing WhatsApp signature.');
    }

    const expected = `sha256=${createHmac('sha256', appSecret).update(input.rawBody).digest('hex')}`;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(input.signature);

    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new UnauthorizedException('Invalid WhatsApp signature.');
    }

    return { mode: 'verified' };
  }
}
