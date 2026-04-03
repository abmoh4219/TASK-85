import { IsUUID, IsNumber, IsPositive, IsOptional, IsDateString } from 'class-validator';

export class AddVendorQuoteDto {
  @IsUUID()
  rfqLineId: string;

  @IsUUID()
  vendorId: string;

  @IsNumber()
  @IsPositive()
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  leadTimeDays?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  notes?: string;
}
