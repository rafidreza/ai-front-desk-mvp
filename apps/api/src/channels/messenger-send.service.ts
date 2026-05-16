import { Injectable } from '@nestjs/common';
import { ChannelSendService } from './channel-send.service';

interface SendTextInput {
  recipientId: string;
  text: string;
}

interface SendTextResult {
  mode: 'dry-run' | 'sent' | 'skipped';
  recipientId: string;
  text: string;
}

@Injectable()
export class MessengerSendService {
  constructor(private readonly channelSend?: ChannelSendService) {}

  async sendText(input: SendTextInput): Promise<SendTextResult> {
    const result = await this.channelSend?.sendText({
      channel: 'messenger',
      recipientId: input.recipientId,
      text: input.text,
      purpose: 'messenger.reply',
    });
    return {
      mode: result?.mode ?? 'dry-run',
      recipientId: input.recipientId,
      text: input.text,
    };
  }
}
