import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LearningPlanStatus } from '../learning-plan.entity';

export class AdvancePlanStatusDto {
  @IsEnum(LearningPlanStatus)
  status: LearningPlanStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
