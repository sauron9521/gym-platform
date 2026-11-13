import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeRecoveryEmail } from '../utils/normalize-recovery-email.js';

import { IsEmail, IsNotEmpty, IsString, IsStrongPassword, Matches } from 'class-validator';

export class SignInDto {
  @ApiProperty({ type: String, format: 'email' })
  @IsEmail()
  email: string;
  @ApiProperty({ type: String, minLength: 1, writeOnly: true })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'Password must contain at least one non-whitespace character',
  })
  password: string;
}
export class SignUpDto {
  @ApiProperty({ type: String, format: 'email' })
  @IsEmail()
  email: string;
  @ApiProperty({ type: String, minLength: 8, writeOnly: true })
  @IsStrongPassword()
  @Matches(/\S/, {
    message: 'Password must contain at least one non-whitespace character',
  })
  password: string;
}

export class EmailDto {
  @ApiProperty({ type: String, format: 'email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeRecoveryEmail(value) : value,
  )
  @ApiProperty({ type: String, format: 'email' })
  @IsEmail()
  email: string;
}

export class VerificationTokenDto {
  @ApiProperty({ type: String, minLength: 1, writeOnly: true })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ResetPasswordDto {
  @ApiProperty({ type: String, minLength: 1, writeOnly: true })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ type: String, minLength: 8, writeOnly: true })
  @IsStrongPassword()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'Password must contain at least one non-whitespace character',
  })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ type: String, minLength: 1, writeOnly: true })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
