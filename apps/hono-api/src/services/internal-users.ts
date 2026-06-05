import { asc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { internalUsers } from '../db/schema';
import type { Env } from '../env';
import { randomId } from '../utils/crypto';
import { timingSafeStringEqual } from '../utils/crypto';

type InternalAuthUser = {
  id: string;
  label: string;
  email?: string;
  role: 'admin' | 'operator' | 'read-only';
};

type SeedUser = InternalAuthUser & {
  password: string;
};

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

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function devInternalUsersEnabled(env: Env) {
  return env.ENABLE_DEV_INTERNAL_USERS === 'true' || env.NODE_ENV !== 'production';
}

function publicUser(user: SeedUser): InternalAuthUser {
  return {
    id: user.id,
    label: user.label,
    email: user.email,
    role: user.role,
  };
}

export function verifyInternalCredentials(input: { identifier: string; password: string }, env: Env): InternalAuthUser | null {
  const identifier = normalizeIdentifier(input.identifier);
  if (identifier.length === 0 || input.password.length === 0) return null;

  const seedUser = seedUsers.find((user) => user.id === identifier || user.email === identifier);
  if (seedUser !== undefined && devInternalUsersEnabled(env) && timingSafeStringEqual(seedUser.password, input.password)) {
    return publicUser(seedUser);
  }

  const configuredPassword = env.INTERNAL_CONSOLE_PASSWORD;
  if (configuredPassword !== undefined && configuredPassword.length > 0 && timingSafeStringEqual(configuredPassword, input.password)) {
    return publicUser(seedUser ?? seedUsers[0]!);
  }

  return null;
}

export class InternalUsersService {
  constructor(private readonly db: AppDb) {}

  async listUsers() {
    const users = await this.db.select().from(internalUsers).orderBy(asc(internalUsers.status), asc(internalUsers.label));
    return users.map((user) => ({
      id: user.id,
      label: user.label,
      email: user.email ?? undefined,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));
  }

  async createUser(input: { label: string; email?: string; role: string }) {
    const now = new Date();
    const email = input.email?.trim() === '' ? undefined : input.email?.trim().toLowerCase();
    const [user] = await this.db
      .insert(internalUsers)
      .values({
        id: randomId('ops-'),
        label: input.label,
        email,
        role: input.role,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return {
      id: user!.id,
      label: user!.label,
      email: user!.email ?? undefined,
      role: user!.role,
      status: user!.status,
      createdAt: user!.createdAt.toISOString(),
      updatedAt: user!.updatedAt.toISOString(),
    };
  }

  async exists(userId: string) {
    const [user] = await this.db.select({ id: internalUsers.id }).from(internalUsers).where(eq(internalUsers.id, userId)).limit(1);
    return user !== undefined;
  }
}
