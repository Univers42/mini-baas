import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  process.env.MONGO_URI ??= `mongodb://${process.env.MONGO_USER ?? 'admin'}:${process.env.MONGO_PASSWORD ?? 'rootpassword'}@${process.env.MONGO_HOST ?? 'localhost'}:${process.env.MONGO_PORT ?? '27018'}`;
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
