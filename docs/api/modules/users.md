# Users module

**Source:** [`apps/api/src/modules/users/`](../../../apps/api/src/modules/users/)

The current-user endpoints are authenticated. Public avatar serving is intentionally separate from authenticated profile mutations.

| Method | Path                     | Purpose                                      |
| ------ | ------------------------ | -------------------------------------------- |
| GET    | `/users/me`              | Read own profile (legacy contract unchanged) |
| GET    | `/users/me/capabilities` | Read own current capability flags            |
| PATCH  | `/users/me`              | Update own profile                           |
| POST   | `/users/me/avatar`       | Upload/replace avatar                        |
| DELETE | `/users/me/avatar`       | Remove avatar                                |
| GET    | `/avatars/:key`          | Public avatar retrieval                      |

## Current capabilities (migration slice #291)

`GET /users/me/capabilities` returns `{ "athlete": boolean, "trainer": boolean, "admin": boolean }`. The authenticated user's identity comes from the server session/JWT, not query parameters; the flags are derived on each request from the **current DB role and TrainerProfile.isActive**, without exposing profile/audit records. The response is `Cache-Control: no-store`.

- `ATHLETE` accounts retain athlete access after trainer approval and after revocation. An active TrainerProfile adds trainer capability; a revoked profile always removes it.
- Legacy `TRAINER` accounts **without any TrainerProfile** temporarily retain trainer capability and gain athlete capability. A present inactive profile takes precedence and denies trainer capability.
- `ADMIN` remains isolated from athlete/trainer capability; the admin flag is informational, **not** an admin authorization token. Existing server-side operator permission checks remain required.
- Public `/users/me` and the legacy `role` field are unchanged. No role mutation, new RBAC table, public grant endpoint, or Prisma migration is needed for this slice (TrainerProfile is supplied by #309).

**Important:** These values allow UIs to explain access. They do not, by themselves, authorize protected trainer operations. Migrate server-side trainer and athlete resource policies under #291 and verify cross-product E2E in #361 **before** enabling Trainer Web routes (#363).

## Internal capability contract (Issue #360)

Other NestJS feature modules should import `deriveAccountCapabilities` and its
snapshot/result types from `#src/modules/users/public-api`, not from the private
`users/policies/account-capabilities.policy` implementation. This public API is a
re-export of the **same** canonical function; there is no duplicated role logic
or new Nest provider.

The `trainer-athletes` invitation and `training-programs` assignment
repositories may evaluate the public contract **only after** acquiring their
existing User and TrainerProfile locks within their own Prisma transactions.
The exported helper does not query the database, acquire locks or authorize
writes by itself. Its input must reflect the current persisted account state.

The API dependency guard accepts the exact `public-api` entrypoint and rejects
direct cross-feature imports of the underlying private policy. Other
cross-domain repository accesses remain separately audited under #360.

Check controller, validation schema and OpenAPI for the current public profile field set. Do not return credential secrets. Avatar writes have additional throttling.

**Tests:** `src/modules/users/test/`, `test/e2e/users/users.e2e-spec.ts`, `test/integration/users/users.repository.integration.e2e-spec.ts`.

See [testing guide](../testing.md).
