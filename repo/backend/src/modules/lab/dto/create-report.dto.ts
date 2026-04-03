import { IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  summary?: string;
}
