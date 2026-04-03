import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project } from './project.entity';
import { ProjectTask } from './project-task.entity';
import { Milestone } from './milestone.entity';
import { Deliverable } from './deliverable.entity';
import { AcceptanceScore } from './acceptance-score.entity';
import { AuditLog } from '../admin/audit-log.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectTask,
      Milestone,
      Deliverable,
      AcceptanceScore,
      AuditLog,
    ]),
  ],
  providers: [ProjectsService, AuditLogService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
