import { IsString, IsOptional, IsNumber, IsUUID, IsBoolean, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateItemDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  sku: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitOfMeasure?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  safetyStockLevel?: number;

  @IsOptional()
  @IsNumber()
  minLevel?: number;

  @IsOptional()
  @IsNumber()
  maxLevel?: number;

  @IsOptional()
  @IsNumber()
  leadTimeDays?: number;

  @IsOptional()
  @IsNumber()
  replenishmentBufferDays?: number;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitOfMeasure?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  safetyStockLevel?: number;

  @IsOptional()
  @IsNumber()
  minLevel?: number;

  @IsOptional()
  @IsNumber()
  maxLevel?: number;

  @IsOptional()
  @IsNumber()
  leadTimeDays?: number;

  @IsOptional()
  @IsNumber()
  replenishmentBufferDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
