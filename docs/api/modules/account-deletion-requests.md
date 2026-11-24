# Account deletion requests module (#297)

**Source:** [`apps/api/src/modules/account-deletion-requests/`](../../../apps/api/src/modules/account-deletion-requests/)

**Implemented:** authenticated request intake and receipt retrieval. This module does not delete an account, revoke its sessions, erase data, or authorize production rollout. Review, execution, retention/legal decisions and verification remain separate S03 data-lifecycle work.

## HTTP contract

| Method | Path                                 | Purpose                                                       |
| ------ | ------------------------------------ | ------------------------------------------------------------- |
| GET    | `/users/me/account-deletion-request` | Read own request receipt or `{ "request": null }`             |
| POST   | `/users/me/account-deletion-request` | Submit a confirmed request; returns HTTP 200 with the receipt |

Both routes require existing cookie session or access-token authentication, use the authenticated account ID and are covered by private API no-store policy. GET uses the `read` limit (60/minute); POST uses `auth` (3/minute) and an additional account-scoped confirmation limit. Strict Zod validation requires `confirm: true`, a non-blank current `password`, and an optional six-digit `totpCode` (required when MFA is enrolled). Unknown fields are rejected.

The response is `{ request: { id, requestedAt, status: "REQUESTED" } }` after successful intake. The original receipt is preserved on a confirmed retry. Credentials and authenticator codes are not receipt fields or persisted in the request record. Consult the generated OpenAPI contract for exact shapes.

## Ownership and transaction boundary

The service checks the current active, non-deleted account, verifies the password and, when enrolled, the authenticator code. The repository locks the account row and rechecks active status, password hash and the authentication invalidation timestamp inside the write transaction. Concurrent password changes or suspension fail closed when the verified account snapshot is no longer valid. An upsert keyed by the account ID preserves one receipt, including its original timestamp, across duplicate submissions. A successful receipt is evidence of intake only, not completion of deletion.

## Verification

- Module unit/controller tests: `apps/api/src/modules/account-deletion-requests/test/`.
- HTTP regressions: `apps/api/test/e2e/users/users.e2e-spec.ts`.
- Use the [API testing guide](../testing.md) and a disposable database for E2E.
- See [S03 privacy and data ownership](../../product-strategy/s03-privacy-data-ownership-v1.md) for the approved broader lifecycle, not an implementation claim.
