import { Type } from 'class-transformer';
import {
  IsUUID, IsArray, ValidateNested,
  IsEnum, IsOptional, IsString,
} from 'class-validator';
import { InspectionResult } from '../po-receipt-line.entity';

export class InspectLineDto {
  @IsUUID()
  receiptLineId: string;

  @IsEnum(InspectionResult)
  result: InspectionResult;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class InspectReceiptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectLineDto)
  lines: InspectLineDto[];
}
