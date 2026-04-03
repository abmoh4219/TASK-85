import { Type } from 'class-transformer';
import {
  IsUUID, IsOptional, IsDateString,
  IsArray, ValidateNested, IsNumber, IsPositive, IsString, MaxLength,
} from 'class-validator';

export class RFQLineDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  @MaxLength(50)
  unitOfMeasure: string;
}

export class CreateRFQDto {
  @IsUUID()
  purchaseRequestId: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RFQLineDto)
  lines: RFQLineDto[];
}
