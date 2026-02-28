import { Module } from '@nestjs/common';
import { DynamicApiModule } from './modules/dynamic-api/dynamic-api.module';

@Module({
  imports: [DynamicApiModule],
  controllers: [],
  providers: [],
})
export class AppModule {}