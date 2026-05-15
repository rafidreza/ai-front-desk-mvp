import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../observability/structured-logger.service';

export interface EmailDeliveryInput {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  tag?: string;
}

export interface EmailDeliveryResult {
  mode: 'dry-run' | 'sent';
  provider: 'postmark';
  to: string;
  subject: string;
  providerMessageId?: string;
}

@Injectable()
export class EmailDeliveryService {
  constructor(private readonly logger?: StructuredLoggerService) {}

  async sendEmail(input: EmailDeliveryInput): Promise<EmailDeliveryResult> {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    const from = process.env.EMAIL_FROM_ADDRESS ?? process.env.DIGEST_FROM_EMAIL;

    if (token === undefined || token === '' || from === undefined || from === '') {
      return {
        mode: 'dry-run',
        provider: 'postmark',
        to: input.to,
        subject: input.subject,
      };
    }

    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        From: from,
        To: input.to,
        Subject: input.subject,
        TextBody: input.textBody,
        HtmlBody: input.htmlBody,
        Tag: input.tag,
        MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger?.event(
        'email.delivery.failed',
        {
          to: input.to,
          subject: input.subject,
          status: response.status,
          errorBody,
        },
        'error',
      );
      throw new Error(`Email delivery failed: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as { MessageID?: string };
    return {
      mode: 'sent',
      provider: 'postmark',
      to: input.to,
      subject: input.subject,
      providerMessageId: data.MessageID,
    };
  }
}
