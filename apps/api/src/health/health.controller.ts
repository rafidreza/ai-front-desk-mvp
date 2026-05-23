import { Controller, Get } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'ai-front-desk-api',
      phase: 'phase-0-messenger-spike',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db')
  async getDatabaseHealth() {
    const database = await this.prisma.ping();
    return {
      status: database.ok ? 'ok' : 'degraded',
      service: 'ai-front-desk-api',
      database,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ai')
  getAiProviderHealth() {
    return this.ai.getProviderHealth();
  }
}
