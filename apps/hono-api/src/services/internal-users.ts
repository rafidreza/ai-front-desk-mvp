import { asc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { internalUsers } from '../db/schema';
import { randomId } from '../utils/crypto';

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
