/**
 * Compatibility aliases for the historical DTO path referenced by the API
 * migration inventory. Runtime validation and OpenAPI use auth.schemas.ts.
 */
export type {
  SignInInput as SignInDto,
  SignUpInput as SignUpDto,
  EmailInput as EmailDto,
  VerificationTokenInput as VerificationTokenDto,
  ResetPasswordInput as ResetPasswordDto,
  RefreshTokenInput as RefreshTokenDto,
} from './auth.schemas.js';
