import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repoEnvPath = resolve(repoRoot, '.env');
if (existsSync(repoEnvPath)) {
  loadEnvFile(repoEnvPath);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  devIndicators: false,
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
