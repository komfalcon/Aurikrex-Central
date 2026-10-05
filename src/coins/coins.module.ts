import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoinsService } from './coins.service';
import { CoinsController } from './coins.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [CoinsService],
  controllers: [CoinsController],
  exports: [CoinsService],
})
export class CoinsModule {}
