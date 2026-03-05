import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// We will import aour modules here when buitl:
// import { InfrastructureModule } from './infrastructure/infrastructure.module';
// import { ControlPlaneModule } from './modules/control-plane/control-plane.module';
// import { EnginesModule } from './modules/engines/engines.module';
// import { DataPlaneModule } from './modules/data-plane/data-plane.module';
// import { RuntimeModule } from './modules/runtime/runtime.module';

@Module({
  imports: [
    // 1. Global conf (env variables)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    
    // 2. SystemDB (Mongo) + Caché (Redis) connection
    // InfrastructureModule,

    // 3. Governance (Metadata, Tenants)
    // ControlPlaneModule,

    // 4. Adapters (Knex, Mongo Driver)
    // EnginesModule,

    // 5. Execution (Dynamic paths, validation)
    // DataPlaneModule,

    // 6. Extensibility (User hooks, second plan proceses)
    // RuntimeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
