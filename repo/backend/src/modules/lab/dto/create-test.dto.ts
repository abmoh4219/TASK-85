import { Type } from 'class-transformer';
import {
  IsString, IsOptional, MaxLength, IsNumber, IsArray, ValidateNested,
} from 'class-validator';

export class ReferenceRangeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  population?: string;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsNumber()
  criticalLow?: number;

  @IsOptional()
  @IsNumber()
  criticalHigh?: number;
}

export class CreateTestDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(50)
  testCode: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sampleType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  referenceRanges?: ReferenceRangeDto[];
}
