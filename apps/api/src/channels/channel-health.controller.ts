import { Controller, Get } from '@nestjs/common';
import { ChannelHealthService } from './channel-health.service';

@Controller('internal/channel-health')
export class ChannelHealthController {
  constructor(private readonly health: ChannelHealthService) {}

  @Get()
  async getChannelHealth() {
    return this.health.getDashboard();
  }
}
