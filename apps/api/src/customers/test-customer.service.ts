import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { Channel, TestCustomer } from '../types/domain';

const ALLOWED_CHANNELS: Channel[] = ['messenger', 'whatsapp', 'web'];

function mapTest(row: {
  id: string;
  clientId: string;
  channel: string;
  externalSenderId: string;
  note: string | null;
  markedBy: string;
  markedAt: Date;
}): TestCustomer {
  return {
    id: row.id,
    clientId: row.clientId,
    channel: row.channel as Channel,
    externalSenderId: row.externalSenderId,
    note: row.note ?? undefined,
    markedBy: row.markedBy,
    markedAt: row.markedAt.toISOString(),
  };
}

@Injectable()
export class TestCustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clientId: string): Promise<TestCustomer[]> {
    if (this.prisma?.enabled !== true) return [];
    const rows = await this.prisma.testCustomer.findMany({
      where: { clientId },
      orderBy: { markedAt: 'desc' },
    });
    return rows.map(mapTest);
  }

  async mark(input: {
    clientId: string;
    channel: string;
    externalSenderId: string;
    note?: string;
    markedBy: string;
  }): Promise<TestCustomer> {
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
      const created = await this.prisma.testCustomer.create({
        data: {
          id: randomUUID(),
          clientId: input.clientId,
          channel: input.channel,
          externalSenderId: input.externalSenderId,
          note: input.note,
          markedBy: input.markedBy,
        },
      });
      return mapTest(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This sender is already marked as a test customer.');
      }
      throw error;
    }
  }

  async unmark(clientId: string, markId: string): Promise<void> {
    if (this.prisma?.enabled !== true) return;
    const existing = await this.prisma.testCustomer.findFirst({
      where: { id: markId, clientId },
    });
    if (existing === null) {
      throw new NotFoundException('Test-customer mark not found.');
    }
    await this.prisma.testCustomer.delete({ where: { id: markId } });
  }

  async isTestCustomer(input: { clientId: string; channel: string; externalSenderId: string }): Promise<boolean> {
    if (this.prisma?.enabled !== true) return false;
    const found = await this.prisma.testCustomer.findFirst({
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
