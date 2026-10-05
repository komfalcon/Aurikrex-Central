import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller(['auth/sso', 'api/v1/auth/sso', 'api/v1/sso'])
export class SsoController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('authorize')
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Query('state') state: string,
    @Query('nonce') nonce: string,
    @Query('scope') scope: string,
    @Query('token') queryToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.authService.validateSsoClient(clientId, redirectUri);

    // If query token is provided or session exists
    let userId: string | null = null;
    if (queryToken) {
      try {
        const user = await this.usersService.findByAurikrexId(queryToken).catch(() => null);
        if (user) userId = user.id;
      } catch {}
    }

    if (!userId) {
      // Dynamic origin redirect to login page
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const reqOrigin = host ? `${protocol}://${host}` : 'https://cbt.aurikrex.com';
      const returnUrl = encodeURIComponent(req.originalUrl || req.url);
      return res.redirect(`${reqOrigin}/auth?returnUrl=${returnUrl}`);
    }

    const code = await this.authService.generateAuthCode({
      clientId,
      userId,
      redirectUri,
      codeChallenge: codeChallenge || '',
      codeChallengeMethod,
      scope,
      nonce,
    });

    const targetUrl = new URL(redirectUri);
    targetUrl.searchParams.set('code', code);
    if (state) targetUrl.searchParams.set('state', state);

    return res.redirect(targetUrl.toString());
  }

  @Post(['token', 'exchange'])
  async token(
    @Body('client_id') clientId: string,
    @Body('code') code: string,
    @Body('code_verifier') codeVerifier: string,
    @Body('redirect_uri') redirectUri: string,
  ) {
    return this.authService.exchangeCode({
      clientId,
      code,
      codeVerifier,
      redirectUri,
    });
  }

  @Get('userinfo')
  async userinfo(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization Bearer token');
    }
    const aurikrexId = authHeader.replace(/^Bearer\s+/i, '');
    return this.usersService.findByAurikrexId(aurikrexId);
  }
}
