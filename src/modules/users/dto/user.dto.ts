import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'staf_depo_1' })
  @IsString()
  @IsNotEmpty({ message: 'Username tidak boleh kosong' })
  username!: string;

  @ApiPropertyOptional({ example: 'staf@hospital.local' })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  email?: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap tidak boleh kosong' })
  full_name!: string;

  @ApiProperty({ example: 'SandiAman123!' })
  @IsString()
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @MinLength(10, { message: 'Password minimal 10 karakter' })
  password!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  must_change_password?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Budi Santoso, S.Farm' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  full_name?: string;

  @ApiPropertyOptional({ example: 'budi.farmasi@hospital.local' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'PasswordBaru123!' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  password?: string;
}

export class RoleAssignmentItemDto {
  @ApiProperty({ example: 'role-uuid-here' })
  @IsUUID('all', { message: 'role_id harus berupa UUID yang valid' })
  @IsNotEmpty()
  role_id!: string;

  @ApiPropertyOptional({ example: 'location-uuid-here', nullable: true })
  @IsOptional()
  @IsUUID('all', { message: 'location_id harus berupa UUID yang valid atau null' })
  location_id?: string | null;
}

export class AssignUserRolesDto {
  @ApiProperty({ type: [RoleAssignmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentItemDto)
  assignments!: RoleAssignmentItemDto[];
}

