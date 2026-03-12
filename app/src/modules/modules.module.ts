import { Module } from '@nestjs/common';
import { CommunicationModule } from './communication/communication.module';
import { ControlPlaneModule } from './control-plane/control-plane.module';
import { DataPlaneModule } from './data-plane/data-plane.module';
import { EnginesModule } from './engines/engines.module';
import { FilesModule } from './files/files.module';
import { GovernanceModule } from './governance/governance.module';
import { SecurityDomainModule } from './security/security-domain.module';

@Module({
  imports: [
    ControlPlaneModule,
    DataPlaneModule,
    SecurityDomainModule,
    GovernanceModule,
    CommunicationModule,
    EnginesModule,
    FilesModule,
  ],
  exports: [
    ControlPlaneModule,
    DataPlaneModule,
    SecurityDomainModule,
    GovernanceModule,
    CommunicationModule,
    EnginesModule,
    FilesModule,
  ],
})
export class ModulesModule {}
