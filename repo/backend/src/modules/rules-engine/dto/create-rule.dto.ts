import {
  IsString, IsOptional, IsEnum, IsObject,
  IsBoolean, IsInt, Min, Max, MaxLength,
} from 'class-validator';
import { RuleCategory } from '../business-rule.entity';

export class CreateRuleDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(RuleCategory)
  category?: RuleCategory;

  @IsObject()
  definition: Record<string, unknown>;

  @IsOptional()
  @IsString()
  changeSummary?: string;

  @IsOptional()
  @IsBoolean()
  isAbTest?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rolloutPercentage?: number;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  changeSummary?: string;

  @IsOptional()
  @IsBoolean()
  isAbTest?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  rolloutPercentage?: number;
}
