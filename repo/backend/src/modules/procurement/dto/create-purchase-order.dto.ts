import { Type } from 'class-transformer';
import {
  IsUUID, IsArray, ValidateNested,
  IsNumber, IsPositive, IsString, MaxLength, IsOptional,
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
  @IsUUID()
  rfqId: string;

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
