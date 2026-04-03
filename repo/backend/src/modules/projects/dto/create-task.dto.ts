import { IsString, IsOptional, IsUUID, IsDateString, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
