import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as http from 'http';

async function bootstrap() {
  const logger = new Logger('AurikrexCentralBootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const primaryPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(primaryPort, '0.0.0.0');
  logger.log(`🏛️ Aurikrex Central Core Microservice listening on primary port ${primaryPort} (0.0.0.0)`);

  const secondaryPort = primaryPort === 3000 ? 4000 : 3000;
  try {
    const expressApp = app.getHttpAdapter().getInstance();
    const secondaryServer = http.createServer(expressApp);
    secondaryServer.listen(secondaryPort, '0.0.0.0', () => {
      logger.log(`🏛️ Dual-port binding active: also listening on port ${secondaryPort} (0.0.0.0) for Pxxl proxy`);
    });
  } catch (err: any) {
    logger.warn(`Secondary port ${secondaryPort} binding skipped: ${err?.message}`);
  }
}
bootstrap();
