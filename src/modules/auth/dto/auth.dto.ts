import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: 'Username tidak boleh kosong' })
  username!: string;

  @ApiProperty({ example: 'SecretPassword123' })
  @IsString()
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @MinLength(10, { message: 'Password minimal 10 karakter' })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123' })
  @IsString()
  @IsNotEmpty({ message: 'Password lama tidak boleh kosong' })
  old_password!: string;

  @ApiProperty({ example: 'NewSecretPassword123' })
  @IsString()
  @IsNotEmpty({ message: 'Password baru tidak boleh kosong' })
  @MinLength(10, { message: 'Password baru minimal 10 karakter' })
  new_password!: string;
}

export class AuthResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  token_type!: string;

  @ApiProperty()
  expires_in!: number;

  @ApiProperty()
  must_change_password!: boolean;
}

