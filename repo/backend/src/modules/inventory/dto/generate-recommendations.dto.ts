import { IsOptional, IsUUID } from 'class-validator';

export class GenerateRecommendationsDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;
}
