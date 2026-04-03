import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateSampleDto {
  @IsString()
  @MaxLength(100)
  sampleType: string;

  @IsDateString()
  collectionDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  patientIdentifier?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
