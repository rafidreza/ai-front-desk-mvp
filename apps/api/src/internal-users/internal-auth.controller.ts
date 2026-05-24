import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { InternalAuthService } from './internal-auth.service';

const InternalLoginSchema = z.object({
  identifier: z.string().trim().min(2).max(120),
  password: z.string().min(1).max(200),
});

@Controller('internal/auth')
export class InternalAuthController {
  constructor(private readonly internalAuth: InternalAuthService) {}

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = InternalLoginSchema.parse(body);
    const user = await this.internalAuth.verifyCredentials(parsed);
    if (user === null) {
      throw new UnauthorizedException('Invalid user or password.');
    }
    return { user };
  }
}
