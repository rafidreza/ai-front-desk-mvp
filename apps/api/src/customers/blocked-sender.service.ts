import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { BlockedSender, Channel } from '../types/domain';

const ALLOWED_CHANNELS: Channel[] = ['messenger', 'whatsapp', 'web'];

function mapBlock(block: {
  id: string;
  clientId: string;
  channel: string;
  externalSenderId: string;
  reason: string | null;
  blockedBy: string;
  blockedAt: Date;
}): BlockedSender {
  return {
    id: block.id,
    clientId: block.clientId,
    channel: block.channel as Channel,
    externalSenderId: block.externalSenderId,
    reason: block.reason ?? undefined,
    blockedBy: block.blockedBy,
    blockedAt: block.blockedAt.toISOString(),
  };
}

@Injectable()
export class BlockedSenderService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clientId: string): Promise<BlockedSender[]> {
    if (this.prisma?.enabled !== true) return [];
    const rows = await this.prisma.blockedSender.findMany({
      where: { clientId },
      orderBy: { blockedAt: 'desc' },
    });
    return rows.map(mapBlock);
  }

  async block(input: {
    clientId: string;
    channel: string;
    externalSenderId: string;
    reason?: string;
    blockedBy: string;
  }): Promise<BlockedSender> {
    if (!ALLOWED_CHANNELS.includes(input.channel as Channel)) {
      throw new BadRequestException(`Channel must be one of: ${ALLOWED_CHANNELS.join(', ')}.`);
    }
    if (input.externalSenderId.trim().length === 0) {
      throw new BadRequestException('externalSenderId is required.');
    }
    if (this.prisma?.enabled !== true) {
      throw new BadRequestException('Database not enabled.');
    }
    try {
      const created = await this.prisma.blockedSender.create({
        data: {
          id: randomUUID(),
          clientId: input.clientId,
          channel: input.channel,
          externalSenderId: input.externalSenderId,
          reason: input.reason,
          blockedBy: input.blockedBy,
        },
      });
      return mapBlock(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This sender is already blocked for this client.');
      }
      throw error;
    }
  }

  async unblock(clientId: string, blockId: string): Promise<void> {
    if (this.prisma?.enabled !== true) return;
    const existing = await this.prisma.blockedSender.findFirst({
      where: { id: blockId, clientId },
    });
    if (existing === null) {
      throw new NotFoundException('Block entry not found.');
    }
    await this.prisma.blockedSender.delete({ where: { id: blockId } });
  }

  async isBlocked(input: { clientId: string; channel: string; externalSenderId: string }): Promise<boolean> {
    if (this.prisma?.enabled !== true) return false;
    const found = await this.prisma.blockedSender.findFirst({
      where: {
        clientId: input.clientId,
        channel: input.channel,
        externalSenderId: input.externalSenderId,
      },
      select: { id: true },
    });
    return found !== null;
  }
}
