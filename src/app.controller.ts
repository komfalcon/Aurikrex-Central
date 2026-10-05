import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth/auth.service';

@Controller()
export class AppController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getRoot() {
    return {
      service: 'Aurikrex Central Core Microservice',
      description: 'Central Identity, SSO Provider, AuriCoin Economy & Shared Knowledge Base',
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        jwks: '/.well-known/jwks.json',
        authorize: '/auth/sso/authorize',
        token: '/auth/sso/token',
        userinfo: '/auth/sso/userinfo',
      },
    };
  }

  @Get('.well-known/jwks.json')
  getJwks() {
    return this.authService.getJwks();
  }
}
