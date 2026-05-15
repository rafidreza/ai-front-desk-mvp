import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../../.env' });
config();

const placeholderDatabaseUrl = 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public';
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const databaseUrl = process.env.DATABASE_URL ?? (isCi ? placeholderDatabaseUrl : undefined);

if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required. Set it in .env locally or as a GitHub Actions secret/env variable.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
