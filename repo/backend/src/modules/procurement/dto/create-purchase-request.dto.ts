import { Type } from 'class-transformer';
import {
  IsString, IsOptional, IsArray, ValidateNested,
  IsUUID, IsNumber, IsPositive, MaxLength,
} from 'class-validator';

export class PurchaseRequestItemDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  @MaxLength(50)
  unitOfMeasure: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseRequestDto {
  @IsOptional()
  @IsString()
  justification?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  items: PurchaseRequestItemDto[];
}
