import { Injectable } from '@nestjs/common';
import { ChannelSendService } from '../channels/channel-send.service';
import { EmailDeliveryService } from './email-delivery.service';

type AuthCodeChannel = 'email' | 'whatsapp';

export interface AuthCodeDeliveryResult {
  mode: 'dry-run' | 'sent' | 'skipped';
  channel: AuthCodeChannel;
  destination: string;
  reason?: string;
}

@Injectable()
export class AuthCodeDeliveryService {
  constructor(
    private readonly email: EmailDeliveryService,
    private readonly channelSend?: ChannelSendService,
  ) {}

  async sendCode(input: {
    businessName: string;
    channel: AuthCodeChannel;
    destination: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<AuthCodeDeliveryResult> {
    if (input.channel === 'email') {
      const result = await this.email.sendEmail({
        to: input.destination,
        subject: `${input.businessName} login code`,
        textBody: `Your AI Front Desk login code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
        htmlBody: `<p>Your AI Front Desk login code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>`,
        tag: 'client-auth-code',
      });
      return { mode: result.mode, channel: 'email', destination: input.destination };
    }

    const result = await this.channelSend?.sendText({
      channel: 'whatsapp',
      recipientId: input.destination,
      text: `Your AI Front Desk login code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
      purpose: 'client-auth-code',
    });

    return {
      mode: result?.mode ?? 'dry-run',
      channel: 'whatsapp',
      destination: result?.recipientId ?? input.destination,
      reason: result?.reason,
    };
  }
}
