import { Type } from 'class-transformer';
import {
  IsUUID, IsOptional, IsNumber, IsString,
  IsArray, ValidateNested,
} from 'class-validator';

export class ResultEntryDto {
  @IsUUID()
  testId: string;

  @IsOptional()
  @IsNumber()
  numericValue?: number;

  @IsOptional()
  @IsString()
  textValue?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultEntryDto)
  results: ResultEntryDto[];
}
