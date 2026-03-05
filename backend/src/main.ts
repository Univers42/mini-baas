import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Global prfix on all paths
  // Data Plane registers always like this: /api/:tenantId/...
  app.setGlobalPrefix('api');

  // 2. CORS Base
  // Permisive CORS for the momement. To do:
  // Implement Guard that reads from Master Document to aply CORS per Tenant.
  app.enableCors();

  // 3. (To do) Inyect TenantInterceptor globaly
  // app.useGlobalInterceptors(new TenantInterceptor());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 mini-baas (App Factory) initialized on port ${port}`);
  console.log(`🧩 Waiting for dynamic requests on http://localhost:${port}/api`);
}

bootstrap();
