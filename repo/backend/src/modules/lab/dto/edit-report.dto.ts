import { IsOptional, IsString } from 'class-validator';

export class EditReportDto {
  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  changeReason?: string;
}
