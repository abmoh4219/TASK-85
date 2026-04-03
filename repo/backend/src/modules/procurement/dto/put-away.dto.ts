import { Type } from 'class-transformer';
import {
  IsUUID, IsArray, ValidateNested,
  IsNumber, IsPositive, IsOptional, IsString, MaxLength,
} from 'class-validator';

export class PutAwayLineDto {
  @IsUUID()
  receiptLineId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsNumber()
  @IsPositive()
  quantityStored: number;
}

export class PutAwayDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PutAwayLineDto)
  lines: PutAwayLineDto[];
}
