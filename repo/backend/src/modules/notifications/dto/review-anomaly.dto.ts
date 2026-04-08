import { IsOptional, IsString, IsEnum } from 'class-validator';
import { AnomalyEventStatus } from '../anomaly-event.entity';

export class ReviewAnomalyDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(AnomalyEventStatus)
  status?: AnomalyEventStatus;
}
