import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoinsService } from './coins.service';

@Controller('api/v1/coins')
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get('balance')
  async getBalance(@Query('userId') userId: string) {
    return this.coinsService.getBalance(userId);
  }

  @Post('deduct')
  async deductCoins(
    @Body('userId') userId: string,
    @Body('appId') appId: string,
    @Body('featureName') featureName: string,
    @Body('idempotencyKey') idempotencyKey?: string,
    @Headers('x-central-api-key') s2sApiKey?: string,
  ) {
    return this.coinsService.deductCoins({
      userIdOrAurikrexId: userId,
      appId,
      featureName,
      idempotencyKey,
      s2sApiKey,
    });
  }

  @Post('refund')
  async refundCoins(
    @Body('transactionId') transactionId: string,
    @Body('userId') userId: string,
    @Body('reason') reason?: string,
    @Headers('x-central-api-key') s2sApiKey?: string,
  ) {
    return this.coinsService.refundCoins({
      transactionId,
      userId,
      reason,
      s2sApiKey,
    });
  }

  @Get('history')
  async getHistory(@Query('userId') userId: string) {
    return this.coinsService.getCoinsHistory(userId);
  }
}
