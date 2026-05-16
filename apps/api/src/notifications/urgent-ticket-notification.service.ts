import { Injectable } from '@nestjs/common';
import { ChannelSendService } from '../channels/channel-send.service';
import { ClientProfile, Ticket } from '../types/domain';

interface NotifyP1Input {
  client: ClientProfile;
  ticket: Ticket;
}

export interface UrgentTicketNotificationResult {
  mode: 'disabled' | 'dry-run' | 'sent' | 'skipped';
  channel: 'whatsapp';
  recipient?: string;
  reason?: string;
  text?: string;
}

function isDisabled() {
  return process.env.ENABLE_P1_WHATSAPP_PINGS === 'false';
}

function getRecipient(client: ClientProfile) {
  const phone = client.whatsappPoc ?? client.ownerPhone;
  if (phone === undefined || phone.trim() === '') return undefined;
  return phone;
}

function truncate(input: string, maxLength: number) {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength - 1)}...`;
}

function buildAlertText(client: ClientProfile, ticket: Ticket) {
  return [
    `P1 support alert for ${client.businessName}`,
    `Ticket: ${ticket.id}`,
    `Reason: ${truncate(ticket.reason, 120)}`,
    `Customer: ${truncate(ticket.customerMessage, 180)}`,
    'Please open the dashboard and respond as soon as possible.',
  ].join('\n');
}

@Injectable()
export class UrgentTicketNotificationService {
  constructor(private readonly channelSend?: ChannelSendService) {}

  async notifyP1(input: NotifyP1Input): Promise<UrgentTicketNotificationResult> {
    if (input.ticket.priority !== 'P1') {
      return { mode: 'skipped', channel: 'whatsapp', reason: 'ticket_priority_not_p1' };
    }

    if (isDisabled()) {
      return { mode: 'disabled', channel: 'whatsapp', reason: 'p1_whatsapp_pings_disabled' };
    }

    const recipient = getRecipient(input.client);
    if (recipient === undefined) {
      return { mode: 'skipped', channel: 'whatsapp', reason: 'missing_whatsapp_poc' };
    }

    const text = buildAlertText(input.client, input.ticket);
    const result = await this.channelSend?.sendText({
      channel: 'whatsapp',
      recipientId: recipient,
      text,
      purpose: 'p1-ticket-alert',
    });

    return {
      mode: result?.mode ?? 'dry-run',
      channel: 'whatsapp',
      recipient: result?.recipientId ?? recipient,
      reason: result?.reason,
      text,
    };
  }
}
