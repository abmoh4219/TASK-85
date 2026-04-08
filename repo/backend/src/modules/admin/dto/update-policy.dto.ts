import { IsObject } from 'class-validator';

export class UpdatePolicyDto {
  @IsObject()
  value: Record<string, unknown>;
}
