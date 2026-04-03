import { Type } from 'class-transformer';
import {
  IsUUID, IsOptional, IsArray, ValidateNested,
  IsNumber, IsPositive, IsString, MaxLength,
} from 'class-validator';

export class POLineDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  unitPrice: number;

  @IsString()
  @MaxLength(50)
  unitOfMeasure: string;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  rfqId?: string;

  @IsUUID()
  vendorId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POLineDto)
  lines: POLineDto[];
}
