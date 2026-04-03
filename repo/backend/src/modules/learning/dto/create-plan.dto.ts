import { IsString, IsOptional, IsUUID, IsDateString, MaxLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetRole?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
