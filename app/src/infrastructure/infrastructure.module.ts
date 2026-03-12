import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { SystemDbModule } from './system-db/system-db.module';

@Module({
  imports: [SystemDbModule, CacheModule],
  exports: [SystemDbModule, CacheModule],
})
export class InfrastructureModule {}
