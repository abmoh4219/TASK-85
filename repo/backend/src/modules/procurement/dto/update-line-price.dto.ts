import { IsNumber, IsPositive } from 'class-validator';

export class UpdateLinePriceDto {
  @IsNumber()
  @IsPositive()
  unitPrice: number;
}
