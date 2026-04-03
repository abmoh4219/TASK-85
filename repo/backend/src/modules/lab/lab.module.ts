import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabService } from './lab.service';
import { LabController } from './lab.controller';
import { LabTestDictionary } from './lab-test-dictionary.entity';
import { ReferenceRange } from './reference-range.entity';
import { LabSample } from './lab-sample.entity';
import { LabResult } from './lab-result.entity';
import { LabReport } from './lab-report.entity';
import { LabReportVersion } from './lab-report-version.entity';
import { AuditLog } from '../admin/audit-log.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabTestDictionary,
      ReferenceRange,
      LabSample,
      LabResult,
      LabReport,
      LabReportVersion,
      AuditLog,
    ]),
  ],
  providers: [LabService, AuditLogService],
  controllers: [LabController],
  exports: [LabService],
})
export class LabModule {}
