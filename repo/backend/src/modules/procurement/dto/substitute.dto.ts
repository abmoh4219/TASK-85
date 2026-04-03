import { IsUUID, IsOptional, IsString } from 'class-validator';

export class ApproveSubstituteDto {
  @IsUUID()
  purchaseRequestItemId: string;

  @IsUUID()
  substituteItemId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
