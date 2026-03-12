import { Module } from '@nestjs/common';
import { IamModule } from './iam/iam.module';
import { MetadataModule } from './metadata/metadata.module';
import { ProvisionerModule } from './provisioner/provisioner.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [IamModule, MetadataModule, ProvisionerModule, TenantModule],
  exports: [IamModule, MetadataModule, ProvisionerModule, TenantModule],
})
export class ControlPlaneModule {}
