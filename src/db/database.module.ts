import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE_DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('TURSO_DATABASE_URL') || 'file:local.db';
        const authToken = configService.get<string>('TURSO_AUTH_TOKEN');
        const client = createClient({
          url,
          authToken: authToken || undefined,
        });
        return drizzle(client, { schema });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
