import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // Future imports:
    // SystemDbModule,
    // CacheModule,
    // EnginesModule,
    // ControlPlaneModule,
    // DataPlaneModule
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}