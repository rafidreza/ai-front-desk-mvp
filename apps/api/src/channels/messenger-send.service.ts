import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../observability/structured-logger.service';

interface SendTextInput {
  recipientId: string;
  text: string;
}

interface SendTextResult {
  mode: 'dry-run' | 'sent';
  recipientId: string;
  text: string;
}

@Injectable()
export class MessengerSendService {
  constructor(private readonly logger?: StructuredLoggerService) {}

  async sendText(input: SendTextInput): Promise<SendTextResult> {
    const token = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
    if (token === undefined || token === '') {
      return {
        mode: 'dry-run',
        recipientId: input.recipientId,
        text: input.text,
      };
    }

    const response = await fetch('https://graph.facebook.com/v20.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        access_token: token,
        recipient: { id: input.recipientId },
        messaging_type: 'RESPONSE',
        message: { text: input.text },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger?.event('messenger.send.failed', {
        recipientId: input.recipientId,
        status: response.status,
        errorBody,
      });
      throw new Error(`Messenger send failed: ${response.status} ${errorBody}`);
    }

    return {
      mode: 'sent',
      recipientId: input.recipientId,
      text: input.text,
    };
  }
}
