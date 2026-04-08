import { IsNumber, Min, Max } from 'class-validator';

export class StageRolloutDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  rolloutPercentage: number;
}
