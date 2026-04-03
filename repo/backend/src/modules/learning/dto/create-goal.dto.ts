import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min, MaxLength,
} from 'class-validator';
import { GoalPriority } from '../learning-goal.entity';

export class CreateGoalDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** Human-readable rule e.g. "3 sessions/week" */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  studyFrequencyRule?: string;

  /** Numeric target extracted from the rule for enforcement */
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionsPerWeek?: number;
}
