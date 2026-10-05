import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SsoController } from './sso.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [AuthService],
  controllers: [AuthController, SsoController],
  exports: [AuthService],
})
export class AuthModule {}
