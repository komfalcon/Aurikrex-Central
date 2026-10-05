import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('.well-known/jwks.json')
  getJwks() {
    return this.authService.getJwks();
  }

  @Post('signup')
  async signup(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('fullName') fullName: string,
    @Body('role') role?: string,
  ) {
    return this.usersService.createUser({ email, password, fullName, role });
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await this.usersService.verifyPassword(
      user.passwordHash,
      password,
    );
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.authService.exchangeCode({
      clientId: 'aurikrex_central',
      code: 'internal',
      codeVerifier: 'internal',
      redirectUri: 'internal',
    }).catch(() => null);

    const { passwordHash, mfa_secret, ...safeUser } = user;
    return {
      user: safeUser,
    };
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }
}
