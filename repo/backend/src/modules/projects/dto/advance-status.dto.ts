import { IsEnum } from 'class-validator';
import { ProjectStatus } from '../project.entity';
import { TaskStatus } from '../project-task.entity';

export class AdvanceProjectStatusDto {
  @IsEnum(ProjectStatus)
  status: ProjectStatus;
}

export class AdvanceTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
