// ============================================
// Transcendence — NestJS Entry Point
// ============================================
// Boots the NestJS application with:
//   • Swagger API documentation
//   • WebSocket gateway (Socket.IO)
//   • Global validation pipe
//   • Helmet security headers
//   • CORS configuration
//   • Rate limiting
// ============================================

import { NestFactory } from '@nestjs/core';
import { Injectable, Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const helmet = require('helmet');
  const compression = require('compression');
  const cookieParser = require('cookie-parser');

  // ── Security ──────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // ── CORS ──────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  });

  // ── Global prefix ─────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Validation ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── WebSocket adapter (Socket.IO) ─────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ── Swagger API Documentation ─────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Transcendence API')
      .setDescription(
        'Public API — Chat, Profiles, Friends, Notifications, Files',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .addTag('health', 'Health check')
      .addTag('auth', 'Authentication & OAuth')
      .addTag('users', 'User profiles & friends')
      .addTag('chat', 'Real-time messaging')
      .addTag('notifications', 'Push & email notifications')
      .addTag('files', 'File upload & management')
      .addTag('search', 'Search with filters & pagination')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ── Start ─────────────────────────────────────────
  const port = process.env.BACKEND_PORT ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Backend running on http://localhost:${port}`);
  logger.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`🔌 WebSocket ready on ws://localhost:${port}`);
}

void bootstrap();

// @Injectable()
// export class AppService {
//   getHello(): string {
//     return 'Hello World!';
//   }
// }