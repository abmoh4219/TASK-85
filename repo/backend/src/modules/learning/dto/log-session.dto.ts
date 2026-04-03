import { IsOptional, IsInt, IsString, IsDateString, Min } from 'class-validator';

export class LogSessionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  sessionDate?: string;
}
