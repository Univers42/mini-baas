import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Security ──────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  
  // 1. Global prfix on all paths
  // Data Plane registers always like this: /api/:tenantId/...
  app.setGlobalPrefix('api');

  // 2. CORS Base
  // Permisive CORS for the momement. To do:
  // Implement Guard that reads from Master Document to aply CORS per Tenant.
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  });

  // 3. (To do) Inyect TenantInterceptor globaly
  // app.useGlobalInterceptors(new TenantInterceptor());

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
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Backend running on http://localhost:${port}`);
  logger.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`🔌 WebSocket ready on ws://localhost:${port}`);
  console.log(`🚀 mini-baas (App Factory) initialized on port ${port}`);
  console.log(`🧩 Waiting for dynamic requests on http://localhost:${port}/api`);
}

bootstrap();
