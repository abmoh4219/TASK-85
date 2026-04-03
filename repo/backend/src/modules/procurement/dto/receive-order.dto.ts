import { Type } from 'class-transformer';
import {
  IsUUID, IsArray, ValidateNested,
  IsNumber, IsPositive, IsOptional, IsString, MaxLength, IsDateString,
} from 'class-validator';

export class ReceiptLineDto {
  @IsUUID()
  poLineId: string;

  @IsNumber()
  @IsPositive()
  receivedQuantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class ReceiveOrderDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines: ReceiptLineDto[];
}
