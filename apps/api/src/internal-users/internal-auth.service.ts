import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { InternalUserRole } from '../types/domain';

type InternalAuthUser = {
  id: string;
  label: string;
  email?: string;
  role: InternalUserRole;
};

type SeedUser = InternalAuthUser & {
  password: string;
};

const keyLength = 64;
const seedUsers: SeedUser[] = [
  {
    id: 'ops-admin',
    label: 'Admin',
    email: 'admin@daemion.local',
    role: 'admin',
    password: 'dev-internal-pass',
  },
  {
    id: 'ops-operator',
    label: 'Operator',
    email: 'operator@daemion.local',
    role: 'operator',
    password: 'dev-operator-pass',
  },
  {
    id: 'ops-viewer',
    label: 'Read Only',
    email: 'viewer@daemion.local',
    role: 'read-only',
    password: 'dev-viewer-pass',
  },
];

function normalizeRole(role: string): InternalUserRole {
  if (role === 'admin') return 'admin';
  if (role === 'read-only' || role === 'viewer') return 'read-only';
  return 'operator';
}

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

@Injectable()
export class InternalAuthService {
  constructor(private readonly prisma?: PrismaService) {}

  hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, keyLength).toString('hex');
    return `scrypt:${salt}:${hash}`;
  }

  verifyPassword(password: string, passwordHash?: string | null) {
    if (passwordHash === undefined || passwordHash === null) return false;
    const [scheme, salt, expectedHash] = passwordHash.split(':');
    if (scheme !== 'scrypt' || salt === undefined || expectedHash === undefined) return false;
    const received = Buffer.from(scryptSync(password, salt, keyLength).toString('hex'), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async verifyCredentials(input: { identifier: string; password: string }): Promise<InternalAuthUser | null> {
    const identifier = normalizeIdentifier(input.identifier);
    if (identifier.length === 0 || input.password.length === 0) return null;

    if (this.prisma?.enabled === true) {
      await this.ensureDevelopmentSeedUsers();
      const user = await this.prisma.internalUser.findFirst({
        where: {
          status: 'active',
          OR: [{ id: identifier }, { email: identifier }],
        },
      });
      if (user === null || !this.verifyPassword(input.password, user.passwordHash)) return null;
      return {
        id: user.id,
        label: user.label,
        email: user.email ?? undefined,
        role: normalizeRole(user.role),
      };
    }

    const seedUser = seedUsers.find((user) => user.id === identifier || user.email === identifier);
    if (seedUser === undefined || seedUser.password !== input.password) return null;
    return {
      id: seedUser.id,
      label: seedUser.label,
      email: seedUser.email,
      role: seedUser.role,
    };
  }

  async ensureDevelopmentSeedUsers() {
    if (this.prisma?.enabled !== true || process.env.NODE_ENV === 'production') return;

    for (const user of seedUsers) {
      await this.prisma.internalUser.upsert({
        where: { id: user.id },
        update: {
          label: user.label,
          email: user.email,
          role: user.role,
          status: 'active',
          passwordHash: this.hashPassword(user.password),
        },
        create: {
          id: user.id,
          label: user.label,
          email: user.email,
          role: user.role,
          status: 'active',
          passwordHash: this.hashPassword(user.password),
        },
      });
    }
  }

  getSeedUsers() {
    return seedUsers;
  }
}
