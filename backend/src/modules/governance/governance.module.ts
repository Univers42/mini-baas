import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';
import { GdprModule } from '../gdpr/gdpr.module';

@Module({
  imports: [AnalyticsModule, AuditModule, GdprModule],
  exports: [AnalyticsModule, AuditModule, GdprModule],
})
export class GovernanceModule {}
