import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { ModulesModule } from './modules/modules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    InfrastructureModule,
    ModulesModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}