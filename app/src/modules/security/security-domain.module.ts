import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { SecurityModule } from './security.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [AuthModule, ApiKeysModule, RbacModule, SecurityModule, SessionModule],
  exports: [AuthModule, ApiKeysModule, RbacModule, SecurityModule, SessionModule],
})
export class SecurityDomainModule {}
