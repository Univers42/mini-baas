import { Module } from '@nestjs/common';
import { DynamicController } from './dynamic.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DynamicController],
})
export class DynamicApiModule {}