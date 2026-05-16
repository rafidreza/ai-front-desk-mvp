import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';

const rootEnvPath = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useBodyParser('json', { limit: '24mb' });
  const allowedOrigin = process.env.WEB_APP_URL ?? 'http://localhost:3002';
  app.enableCors({
    origin: allowedOrigin.split(',').map((origin) => origin.trim()),
    credentials: false,
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`AI Front Desk API listening on http://localhost:${port}`);
}

void bootstrap();
