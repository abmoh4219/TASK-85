import { IsString, IsEnum, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { UserRole } from '../user.entity';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
