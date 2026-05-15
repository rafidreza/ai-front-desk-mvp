import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
}
