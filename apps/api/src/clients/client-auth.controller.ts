import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { ClientAuthService } from './client-auth.service';

const RequestCodeSchema = z.object({
  identifier: z.string().trim().min(2),
  channel: z.enum(['email', 'whatsapp']).optional(),
});

const VerifyCodeSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});

@Controller('client-auth')
export class ClientAuthController {
  constructor(private readonly auth: ClientAuthService) {}

  @Post('request')
  async requestCode(@Body() body: unknown) {
    const parsed = RequestCodeSchema.parse(body);
    return { challenge: await this.auth.requestCode(parsed) };
  }

  @Post('verify')
  async verifyCode(@Body() body: unknown) {
    const parsed = VerifyCodeSchema.parse(body);
    return { client: await this.auth.verifyCode(parsed) };
  }
}
