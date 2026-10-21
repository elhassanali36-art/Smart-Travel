import './common/load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './common/config.service';
import { HttpErrorFilter } from './common/http-error.filter';
import { securityHeaders } from './common/security-headers';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  config.validate();

  const http = app.getHttpAdapter().getInstance();
  http.disable('x-powered-by');
  if (config.trustProxy !== undefined) http.set('trust proxy', config.trustProxy);

  app.use(securityHeaders(config.isProduction));
  app.enableCors({ origin: config.webOrigin, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
  await app.listen(config.port);
}
bootstrap();
