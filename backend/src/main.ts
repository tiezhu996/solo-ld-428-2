import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ErrorHandlerMiddleware } from './middlewares/errorHandler.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new ErrorHandlerMiddleware());
  app.getHttpAdapter().get('/health', (_req, res) => res.json({ status: 'ok', service: 'art-gallery' }));
  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
