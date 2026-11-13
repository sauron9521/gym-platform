# Authentication module

**Source:** [`apps/api/src/modules/auth/`](../../../apps/api/src/modules/auth/)  
**Controller directory:** `src/modules/auth/controllers/`

## Responsibilities

Registration, credential sign-in, session and token lifecycle, email verification and resend, password recovery, account-related throttling and no-store HTTP responses. The implementation integrates `@nestjs/authentication` and application-specific services/stores.

## HTTP surface

| Method | Path                          | Purpose                               |
| ------ | ----------------------------- | ------------------------------------- |
| POST   | `/auth/register`              | Register and create a sign-in session |
| POST   | `/auth/login`                 | Authenticate with credentials         |
| POST   | `/auth/email/verify`          | Verify email token                    |
| POST   | `/auth/email/verification`    | Request verification resend           |
| POST   | `/auth/password-reset/forgot` | Request recovery                      |
| POST   | `/auth/password-reset/reset`  | Complete password reset               |
| GET    | `/auth/sessions`              | List active sessions                  |
| DELETE | `/auth/sessions/:id`          | Revoke a session                      |
| POST   | `/auth/sign-out`              | Sign out                              |
| POST   | `/auth/sign-out-everywhere`   | Revoke all sessions                   |
| POST   | `/auth/token`                 | Issue token                           |
| POST   | `/auth/token/refresh`         | Refresh token                         |
| POST   | `/auth/token/revoke`          | Revoke token                          |

Exact request/response bodies, authentication requirements and status codes are defined by controllers and generated OpenAPI; do not infer them from this overview.

## Validation and security

Auth HTTP controllers validate bodies through Nest 12's `@Body({ schema })` and strict Zod schemas in `src/modules/auth/dto/auth.schemas.ts`. OpenAPI request bodies are now generated from the same strict Zod schemas as runtime validation; the frontend client is regenerated from that contract. The old decorated DTO source is retained temporarily for removal in a follow-up audit but is no longer referenced by Auth controllers. Both production and relevant HTTP test hosts register `StandardSchemaValidationPipe`. Remove the legacy DTOs and class-validation dependencies only after auditing all consumers and verifying generated OpenAPI/client compatibility.

Preserve email normalization behavior, password constraints, throttling, session invalidation and redaction/no-store semantics. Never include tokens, passwords or email addresses in logs.

## Verification

- Unit: `src/modules/auth/test/`
- HTTP e2e: `test/auth.e2e-spec.ts`, `test/tokens.controller.e2e-spec.ts` and other `test/*auth*.e2e-spec.ts`
- Database contracts: `test/integration/auth*.integration.e2e-spec.ts`, session/token-store contract specs

See [testing guide](../testing.md) and regenerate the frontend API client after changing contract-visible DTOs.
