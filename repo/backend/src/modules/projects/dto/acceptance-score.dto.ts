import { IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';

export class AcceptanceScoreDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxScore?: number;

  @IsOptional()
  @IsUUID()
  deliverableId?: string;

  @IsOptional()
  @IsString()
  feedback?: string;
}
