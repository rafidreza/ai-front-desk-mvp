import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  readonly enabled = true;
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString === undefined || connectionString === '') {
      throw new Error('DATABASE_URL is required to start the API.');
    }
    const pool = new Pool({ connectionString });

    super({
      adapter: new PrismaPg(pool),
    });

    this.pool = pool;
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  async ping(): Promise<{ enabled: boolean; ok: boolean; latencyMs?: number; error?: string }> {
    const startedAt = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return { enabled: true, ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        enabled: true,
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown database error.',
      };
    }
  }
}
