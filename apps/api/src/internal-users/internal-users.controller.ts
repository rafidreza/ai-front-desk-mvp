import { Body, Controller, Get, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service';

type InternalUserRecord = {
  id: string;
  label: string;
  email?: string;
  role: string;
  status: string;
};

export const internalUsers: InternalUserRecord[] = [
  { id: 'ops-nabil', label: 'Nabil', role: 'admin', status: 'active' },
  { id: 'ops-support', label: 'Support', role: 'support', status: 'active' },
  { id: 'ops-sales', label: 'Sales', role: 'sales', status: 'active' },
];

const CreateInternalUserSchema = z.object({
  label: z.string().trim().min(2).max(80),
  email: z.string().trim().email().optional().or(z.literal('')),
  role: z.enum(['admin', 'support', 'sales', 'qa', 'viewer']).default('support'),
});

function toInternalUser(user: {
  id: string;
  label: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    label: user.label,
    email: user.email ?? undefined,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Controller('internal/users')
export class InternalUsersController {
  constructor(private readonly prisma?: PrismaService) {}

  @Get()
  async listUsers() {
    if (this.prisma?.enabled === true) {
      const users = await this.prisma.internalUser.findMany({
        orderBy: [{ status: 'asc' }, { label: 'asc' }],
      });
      return { users: users.map(toInternalUser) };
    }

    return { users: internalUsers };
  }

  @Post()
  async createUser(@Body() body: unknown) {
    const parsed = CreateInternalUserSchema.parse(body);
    const email = parsed.email?.trim() === '' ? undefined : parsed.email?.trim().toLowerCase();

    if (this.prisma?.enabled !== true) {
      const user = {
        id: `ops-${randomUUID()}`,
        label: parsed.label,
        email,
        role: parsed.role,
        status: 'active',
      };
      internalUsers.push(user);
      return { user };
    }

    const user = await this.prisma.internalUser.create({
      data: {
        id: `ops-${randomUUID()}`,
        label: parsed.label,
        email,
        role: parsed.role,
        status: 'active',
      },
    });

    return { user: toInternalUser(user) };
  }
}
