import { Body, Controller, Get, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service';
import { InternalUserRole } from '../types/domain';
import { InternalAuthService } from './internal-auth.service';

type InternalUserRecord = {
  id: string;
  label: string;
  email?: string;
  role: InternalUserRole;
  status: string;
};

export const internalUsers: InternalUserRecord[] = [
  { id: 'ops-admin', label: 'Admin', email: 'admin@daemon.local', role: 'admin', status: 'active' },
  { id: 'ops-operator', label: 'Operator', email: 'operator@daemon.local', role: 'operator', status: 'active' },
  { id: 'ops-viewer', label: 'Read Only', email: 'viewer@daemon.local', role: 'read-only', status: 'active' },
];

const CreateInternalUserSchema = z.object({
  label: z.string().trim().min(2).max(80),
  email: z.string().trim().email().optional().or(z.literal('')),
  role: z.enum(['admin', 'operator', 'read-only']).default('operator'),
  password: z.string().min(8).max(120),
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
  constructor(
    private readonly internalAuth: InternalAuthService,
    private readonly prisma?: PrismaService,
  ) {}

  @Get()
  async listUsers() {
    if (this.prisma?.enabled === true) {
      await this.internalAuth.ensureDevelopmentSeedUsers();
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
        passwordHash: this.internalAuth.hashPassword(parsed.password),
      },
    });

    return { user: toInternalUser(user) };
  }
}
