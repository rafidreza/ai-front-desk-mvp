import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const repoEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
if (existsSync(repoEnvPath)) {
  loadEnvFile(repoEnvPath);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
