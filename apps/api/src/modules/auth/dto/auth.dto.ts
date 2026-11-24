/**
 * Compatibility alias for the historical DTO path referenced by the API
 * migration inventory. Runtime validation and OpenAPI use auth.schemas.ts.
 */
export type { SignInInput as SignInDto } from './auth.schemas.js';
