import { Module } from '@nestjs/common';
import { DynamicApiModule } from './dynamic-api/dynamic-api.module';
import { TransformationModule } from './transformation/transformation.module';
import { ValidationModule } from './validation/validation.module';

@Module({
  imports: [DynamicApiModule, TransformationModule, ValidationModule],
  exports: [DynamicApiModule, TransformationModule, ValidationModule],
})
export class DataPlaneModule {}
