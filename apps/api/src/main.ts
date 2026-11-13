import { ConsoleLogger, Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '#src/app.module';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { getCorsOrigins, getWebAppOrigin } from '#src/common/config/http.config';
import { getTrustedProxies } from '#src/common/config/proxy.config';
import { getLogLevels } from '#src/common/config/logger.config';
import { enableOpenApi } from '#src/infra/openapi/openapi';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ json: process.env.NODE_ENV === 'production' }),
  });
  const config = app.get<AppConfigService>(ConfigService);
  const trustedProxies = getTrustedProxies(config.get('TRUSTED_PROXY_CIDRS'));
  if (trustedProxies.length > 0) {
    // Only explicit reverse-proxy source networks can supply client IPs.
    // Never trust arbitrary X-Forwarded-For headers or a variable hop count.
    app.set('trust proxy', trustedProxies);
  }

  // The Zod parser validates the level and provides its default before use.
  app.useLogger(
    new ConsoleLogger({
      json: config.getOrThrow('NODE_ENV') === 'production',
      logLevels: getLogLevels(config.getOrThrow('LOG_LEVEL')),
    }),
  );

  //CORS
  const corsOrigins = getCorsOrigins(config.getOrThrow('CORS_ORIGINS'));

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });

  // Browser writes from the configured web app are permitted; arbitrary origins remain blocked.
  app.enableCsrfProtection({
    trustedOrigins: [getWebAppOrigin(config.getOrThrow('APP_URL'))],
  });

  // All request DTOs now use Nest 12 Standard Schema/Zod validation.
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  // Documentation is opt-in, never exposed to production by default.
  if (config.get('ENABLE_OPENAPI') === true) {
    enableOpenApi(app);
  }

  app.enableShutdownHooks();
  const port = config.getOrThrow('PORT');
  await app.listen(port);
  Logger.log('App started on port: ' + port, 'Bootstrap');
}
await bootstrap();
