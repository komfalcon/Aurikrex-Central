import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CoinsService } from './coins.service';

import * as jwt from 'jsonwebtoken';

@Controller('api/v1/coins')
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get('balance')
  async getBalance(
    @Query('userId') queryUserId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let targetId = queryUserId;
    if (!targetId && authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const decoded: any = jwt.decode(token);
        targetId = decoded?.sub || decoded?.id || decoded?.aurikrex_id || decoded?.email;
      } catch {}
    }
    if (!targetId) {
      throw new BadRequestException('userId query parameter or Authorization Bearer token is required');
    }
    return this.coinsService.getBalance(targetId);
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
