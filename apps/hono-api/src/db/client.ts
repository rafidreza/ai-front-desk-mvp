import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import { schema, type DbSchema } from './schema';

export type AppDb = NeonDatabase<DbSchema>;

export type AppVariables = {
  db?: AppDb;
  dbPool?: Pool;
};

export type AppBindings = {
  Bindings: Env;
  Variables: AppVariables;
};

export function createDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return { pool, db: drizzle(pool, { schema }) };
}

export function requireDb(c: Context<AppBindings>) {
  const db = c.get('db');
  if (db === undefined) {
    throw new Error('DATABASE_URL is required for this endpoint.');
  }
  return db;
}

export const dbMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const databaseUrl = c.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    await next();
    return;
  }

  const { pool, db } = createDb(databaseUrl);
  c.set('dbPool', pool);
  c.set('db', db);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
};
