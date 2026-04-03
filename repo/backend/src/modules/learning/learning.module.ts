import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningService } from './learning.service';
import { LearningController } from './learning.controller';
import { LearningPlan } from './learning-plan.entity';
import { LearningGoal } from './learning-goal.entity';
import { StudySession } from './study-session.entity';
import { LearningPlanLifecycle } from './learning-plan-lifecycle.entity';
import { AuditLog } from '../admin/audit-log.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LearningPlan,
      LearningGoal,
      StudySession,
      LearningPlanLifecycle,
      AuditLog,
    ]),
  ],
  providers: [LearningService, AuditLogService],
  controllers: [LearningController],
  exports: [LearningService],
})
export class LearningModule {}
