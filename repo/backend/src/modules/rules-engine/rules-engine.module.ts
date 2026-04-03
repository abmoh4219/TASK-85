import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesEngineService } from './rules-engine.service';
import { RulesEngineController } from './rules-engine.controller';
import { BusinessRule } from './business-rule.entity';
import { RuleVersion } from './rule-version.entity';
import { RuleRollout } from './rule-rollout.entity';
import { RolloutFeedback } from './rollout-feedback.entity';
import { AuditLog } from '../admin/audit-log.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessRule,
      RuleVersion,
      RuleRollout,
      RolloutFeedback,
      AuditLog,
    ]),
  ],
  providers: [RulesEngineService, AuditLogService],
  controllers: [RulesEngineController],
  exports: [RulesEngineService],
})
export class RulesEngineModule {}
