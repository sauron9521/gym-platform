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

Auth HTTP controllers validate bodies through Nest 12's `@Body({ schema })` and strict Zod schemas in `src/modules/auth/dto/auth.schemas.ts`. OpenAPI request bodies are now generated from the same strict Zod schemas as runtime validation; the frontend client is regenerated from that contract. The historical `auth.dto.ts` path now exports only TypeScript aliases for the Zod request types; it is retained so the frozen API migration inventory remains valid. Production bootstrap uses only `StandardSchemaValidationPipe`. All HTTP test hosts and production API now use `StandardSchemaValidationPipe`. The direct `class-validator` and `class-transformer` API dependencies have been removed; NestJS may still declare them as optional peer dependencies and the lockfile may retain transitive resolutions. The request contract and generated OpenAPI remain Zod-based.

Preserve email normalization behavior, password constraints, throttling, session invalidation and redaction/no-store semantics. Never include tokens, passwords or email addresses in logs.

## Verification

- Unit: `src/modules/auth/test/`
- HTTP e2e: `test/e2e/auth/` (registration/login, token issuance, endpoint throttling); remaining Auth integration/HTTP suites reside under `test/integration/` and the legacy `test/` root
- Database integration: `test/integration/auth/` (credential, token-flow and email-verification suites); additional Auth suites and session/token-store contracts remain in `test/integration/` for phased relocation

See [testing guide](../testing.md) and regenerate the frontend API client after changing contract-visible DTOs.
