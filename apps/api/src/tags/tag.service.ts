import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { TAG_COLORS, Tag, TagColor } from '../types/domain';

function mapTag(tag: {
  id: string;
  clientId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}): Tag {
  return {
    id: tag.id,
    clientId: tag.clientId,
    name: tag.name,
    color: tag.color as TagColor,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

function assertColor(color: string): TagColor {
  if (!TAG_COLORS.includes(color as TagColor)) {
    throw new BadRequestException(`Color must be one of: ${TAG_COLORS.join(', ')}.`);
  }
  return color as TagColor;
}

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clientId: string): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany({
      where: { clientId },
      orderBy: { name: 'asc' },
    });
    return tags.map(mapTag);
  }

  async create(clientId: string, input: { name: string; color: string }): Promise<Tag> {
    const name = input.name.trim();
    if (name.length === 0 || name.length > 30) {
      throw new BadRequestException('Tag name must be 1 to 30 characters.');
    }
    const color = assertColor(input.color);
    try {
      const created = await this.prisma.tag.create({
        data: {
          id: randomUUID(),
          clientId,
          name,
          color,
        },
      });
      return mapTag(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Tag "${name}" already exists for this client.`);
      }
      throw error;
    }
  }

  async update(
    clientId: string,
    tagId: string,
    input: { name?: string; color?: string },
  ): Promise<Tag> {
    const existing = await this.prisma.tag.findFirst({ where: { id: tagId, clientId } });
    if (existing === null) {
      throw new NotFoundException('Tag not found.');
    }
    const data: { name?: string; color?: TagColor } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0 || name.length > 30) {
        throw new BadRequestException('Tag name must be 1 to 30 characters.');
      }
      data.name = name;
    }
    if (input.color !== undefined) {
      data.color = assertColor(input.color);
    }
    try {
      const updated = await this.prisma.tag.update({ where: { id: tagId }, data });
      return mapTag(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Tag "${data.name}" already exists for this client.`);
      }
      throw error;
    }
  }

  async delete(clientId: string, tagId: string): Promise<void> {
    const existing = await this.prisma.tag.findFirst({ where: { id: tagId, clientId } });
    if (existing === null) {
      throw new NotFoundException('Tag not found.');
    }
    await this.prisma.tag.delete({ where: { id: tagId } });
  }

  async addToTicket(ticketId: string, tagId: string): Promise<Tag[]> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (ticket === null) {
      throw new NotFoundException('Ticket not found.');
    }
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, clientId: ticket.clientId },
    });
    if (tag === null) {
      throw new NotFoundException('Tag not found for this client.');
    }
    await this.prisma.ticketTag.upsert({
      where: { ticketId_tagId: { ticketId, tagId } },
      update: {},
      create: { ticketId, tagId },
    });
    return this.listForTicket(ticketId);
  }

  async removeFromTicket(ticketId: string, tagId: string): Promise<Tag[]> {
    await this.prisma.ticketTag.deleteMany({ where: { ticketId, tagId } });
    return this.listForTicket(ticketId);
  }

  async listForTicket(ticketId: string): Promise<Tag[]> {
    const rows = await this.prisma.ticketTag.findMany({
      where: { ticketId },
      include: { tag: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => mapTag(row.tag));
  }

  async bulkApplyToTickets(
    clientId: string,
    ticketIds: string[],
    tagId: string,
  ): Promise<{ applied: number }> {
    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, clientId } });
    if (tag === null) {
      throw new NotFoundException('Tag not found for this client.');
    }
    const tickets = await this.prisma.ticket.findMany({
      where: { id: { in: ticketIds }, clientId },
      select: { id: true },
    });
    const validIds = tickets.map((ticket) => ticket.id);
    if (validIds.length === 0) {
      return { applied: 0 };
    }
    await this.prisma.ticketTag.createMany({
      data: validIds.map((ticketId) => ({ ticketId, tagId })),
      skipDuplicates: true,
    });
    return { applied: validIds.length };
  }
}
