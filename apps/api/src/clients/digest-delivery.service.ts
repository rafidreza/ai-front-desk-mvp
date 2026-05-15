import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailDeliveryService, EmailDeliveryResult } from '../notifications/email-delivery.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { ClientDashboardService } from './client-dashboard.service';
import { PilotClientService } from './pilot-client.service';

type DigestCadence = 'daily' | 'weekly';

export interface DigestDeliveryResult {
  cadence: DigestCadence;
  clientId: string;
  destination: string;
  subject: string;
  generatedAt: string;
  delivery: EmailDeliveryResult;
}

function buildDigestText(input: {
  businessName: string;
  subject: string;
  narrative: string;
  summary: {
    conversations: number;
    tickets: number;
    openTickets: number;
    resolvedTickets: number;
    p1Tickets: number;
    containmentRate: number;
    averageConfidence: number;
    averageCsat: number | null;
    salesRecoveredEstimate: number;
  };
}) {
  return [
    input.subject,
    '',
    input.narrative,
    '',
    `Conversations handled: ${input.summary.conversations}`,
    `Tickets created: ${input.summary.tickets}`,
    `Open tickets: ${input.summary.openTickets}`,
    `Resolved tickets: ${input.summary.resolvedTickets}`,
    `P1 tickets: ${input.summary.p1Tickets}`,
    `Containment: ${input.summary.containmentRate}%`,
    `Average confidence: ${input.summary.averageConfidence}%`,
    `Average CSAT: ${input.summary.averageCsat ?? 'Not enough ratings yet'}`,
    `Estimated sales protected: BDT ${input.summary.salesRecoveredEstimate}`,
    '',
    'Open your AI Front Desk dashboard to review pending handoffs.',
  ].join('\n');
}

function buildDigestHtml(text: string) {
  return text
    .split('\n')
    .map((line) => (line === '' ? '<br />' : `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`))
    .join('');
}

@Injectable()
export class DigestDeliveryService {
  constructor(
    private readonly dashboard: ClientDashboardService,
    private readonly clients: PilotClientService,
    private readonly email: EmailDeliveryService,
    private readonly logger?: StructuredLoggerService,
  ) {}

  async sendDigest(clientId: string, cadence: DigestCadence): Promise<DigestDeliveryResult> {
    const [client, preview] = await Promise.all([
      this.clients.findById(clientId),
      this.dashboard.getDigestPreview(clientId, cadence),
    ]);
    const destination = client.digestEmail ?? client.ownerEmail;
    if (destination === undefined || destination.trim() === '') {
      throw new BadRequestException('Client does not have a digest email configured.');
    }

    const textBody = buildDigestText({
      businessName: client.businessName,
      subject: preview.subject,
      narrative: preview.narrative,
      summary: preview.summary,
    });
    const delivery = await this.email.sendEmail({
      to: destination,
      subject: preview.subject,
      textBody,
      htmlBody: buildDigestHtml(textBody),
      tag: `${cadence}-digest`,
    });

    this.logger?.event('digest.delivery.completed', {
      clientId,
      cadence,
      mode: delivery.mode,
      provider: delivery.provider,
    });

    return {
      cadence,
      clientId,
      destination,
      subject: preview.subject,
      generatedAt: preview.generatedAt,
      delivery,
    };
  }
}
