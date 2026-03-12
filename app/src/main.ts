import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  // ── Security & Middleware ──
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // ── Global Exception Filter (Prevents Data Leakage) ──
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global Validation ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── CORS Configuration ──
  app.enableCors({
    origin: config.get('CORS_ORIGINS', '*'),
    credentials: true,
  });

  // ── Swagger API Documentation Setup ──
  if (config.get('SWAGGER_ENABLED') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('mini-baas Engine')
      .setDescription('Metadata-driven polyglot Backend-as-a-Service')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  Logger.log(`mini-baas running on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger Docs: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();