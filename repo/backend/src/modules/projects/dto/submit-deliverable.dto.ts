import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SubmitDeliverableDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
