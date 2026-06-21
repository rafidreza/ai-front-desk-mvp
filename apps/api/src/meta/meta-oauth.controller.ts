import { Body, Controller, Get, Param, Post, Query, Redirect } from '@nestjs/common';
import { z } from 'zod';
import { MetaOAuthService } from './meta-oauth.service';

const StartMetaOAuthSchema = z.object({
  returnTo: z.string().trim().optional(),
});

const SelectMetaPageSchema = z.object({
  pageId: z.string().trim().min(2),
});

function webAppUrl() {
  return (process.env.WEB_APP_URL ?? 'http://localhost:3002').split(',')[0] ?? 'http://localhost:3002';
}

function callbackRedirect(input: { clientId?: string; sessionId?: string; status: string; message?: string }) {
  const url = new URL('/client/meta/select', webAppUrl());
  if (input.clientId !== undefined) url.searchParams.set('clientId', input.clientId);
  if (input.sessionId !== undefined) url.searchParams.set('sessionId', input.sessionId);
  url.searchParams.set('status', input.status);
  if (input.message !== undefined) url.searchParams.set('message', input.message);
  return url.toString();
}

@Controller()
export class MetaOAuthController {
  constructor(private readonly metaOAuth: MetaOAuthService) {}

  @Post('clients/:clientId/meta/oauth/start')
  async start(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = StartMetaOAuthSchema.parse(body);
    return this.metaOAuth.start({ clientId, returnTo: parsed.returnTo });
  }

  @Get('oauth/meta/callback')
  @Redirect()
  async callback(
    @Query('state') state?: string,
    @Query('code') code?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (state === undefined || state.trim() === '') {
      return {
        url: callbackRedirect({
          status: 'failed',
          message: 'Meta did not return a valid connection session. Start the Facebook Page connection again from your dashboard.',
        }),
      };
    }

    try {
      const result = await this.metaOAuth.handleCallback({ state, code, error, errorDescription });
      return {
        url: callbackRedirect({
          clientId: result.clientId,
          sessionId: result.sessionId,
          status: result.status,
          message: result.status === 'failed' ? 'Meta authorization was cancelled or failed.' : undefined,
        }),
      };
    } catch {
      return {
        url: callbackRedirect({
          status: 'failed',
          message: 'Daemion could not complete the Facebook Page connection. Please start the connection again.',
        }),
      };
    }
  }

  @Get('clients/:clientId/meta/oauth-sessions/:sessionId')
  async session(@Param('clientId') clientId: string, @Param('sessionId') sessionId: string) {
    return { session: await this.metaOAuth.getSessionForClient({ clientId, sessionId }) };
  }

  @Post('clients/:clientId/meta/oauth-sessions/:sessionId/select')
  async select(@Param('clientId') clientId: string, @Param('sessionId') sessionId: string, @Body() body: unknown) {
    const parsed = SelectMetaPageSchema.parse(body);
    return { connection: await this.metaOAuth.selectPage({ clientId, sessionId, pageId: parsed.pageId }) };
  }

  @Post('clients/:clientId/meta/disconnect')
  async disconnect(@Param('clientId') clientId: string) {
    return { connection: await this.metaOAuth.disconnectPage({ clientId }) };
  }
}
