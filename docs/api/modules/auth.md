# Authentication module

**Source:** [`apps/api/src/modules/auth/`](../../../apps/api/src/modules/auth/)  
**Controller directory:** `src/modules/auth/controllers/`

## Responsibilities

Registration, credential sign-in, session and token lifecycle, email verification and resend, password recovery, account-related throttling and no-store HTTP responses. The implementation integrates `@nestjs/authentication` and application-specific services/stores.

## HTTP surface

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Register and create a sign-in session |
| POST | `/auth/login` | Authenticate with credentials |
| POST | `/auth/email/verify` | Verify email token |
| POST | `/auth/email/verification` | Request verification resend |
| POST | `/auth/password-reset/forgot` | Request recovery |
| POST | `/auth/password-reset/reset` | Complete password reset |
| GET | `/auth/sessions` | List active sessions |
| DELETE | `/auth/sessions/:id` | Revoke a session |
| POST | `/auth/sign-out` | Sign out |
| POST | `/auth/sign-out-everywhere` | Revoke all sessions |
| POST | `/auth/token` | Issue token |
| POST | `/auth/token/refresh` | Refresh token |
| POST | `/auth/token/revoke` | Revoke token |

Exact request/response bodies, authentication requirements and status codes are defined by controllers and generated OpenAPI; do not infer them from this overview.

## Validation and security

At the time this page was introduced, `src/modules/auth/dto/auth.dto.ts` still uses `class-validator`/`class-transformer`, while `src/main.ts` installs both `ValidationPipe` and `StandardSchemaValidationPipe`. The intended follow-up is Zod/Standard Schema migration with HTTP behavior and OpenAPI parity tests. **Do not remove the global class-validation pipe or dependencies before auditing every consumer.**

Preserve email normalization behavior, password constraints, throttling, session invalidation and redaction/no-store semantics. Never include tokens, passwords or email addresses in logs.

## Verification

- Unit: `src/modules/auth/test/`
- HTTP e2e: `test/auth.e2e-spec.ts`, `test/tokens.controller.e2e-spec.ts` and other `test/*auth*.e2e-spec.ts`
- Database contracts: `test/integration/auth*.integration.e2e-spec.ts`, session/token-store contract specs

See [testing guide](../testing.md) and regenerate the frontend API client after changing contract-visible DTOs.
