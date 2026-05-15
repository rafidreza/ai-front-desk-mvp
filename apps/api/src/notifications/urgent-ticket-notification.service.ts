import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../observability/structured-logger.service';
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

function normalizeRecipient(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('01')) return `88${digits}`;
  return digits;
}

function getRecipient(client: ClientProfile) {
  const phone = client.whatsappPoc ?? client.ownerPhone;
  if (phone === undefined || phone.trim() === '') return undefined;
  const normalized = normalizeRecipient(phone);
  return normalized.length >= 8 ? normalized : undefined;
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
  constructor(private readonly logger?: StructuredLoggerService) {}

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
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (accessToken === undefined || accessToken === '' || phoneNumberId === undefined || phoneNumberId === '') {
      return { mode: 'dry-run', channel: 'whatsapp', recipient, text };
    }

    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v20.0';
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger?.event(
        'p1_whatsapp_ping.failed',
        {
          ticketId: input.ticket.id,
          clientId: input.ticket.clientId,
          status: response.status,
          errorBody,
        },
        'error',
      );
      throw new Error(`P1 WhatsApp ping failed: ${response.status} ${errorBody}`);
    }

    return { mode: 'sent', channel: 'whatsapp', recipient, text };
  }
}
