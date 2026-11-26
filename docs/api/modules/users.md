# Users module

**Source:** [`apps/api/src/modules/users/`](../../../apps/api/src/modules/users/)

The current-user endpoints are authenticated. Public avatar serving is intentionally separate from authenticated profile mutations.

| Method | Path                                        | Purpose                                              |
| ------ | ------------------------------------------- | ---------------------------------------------------- |
| GET    | `/users/me`                                 | Read own profile (legacy contract unchanged)         |
| GET    | `/users/me/capabilities`                    | Read own current capability flags                    |
| GET    | `/users/me/account-deletion-request`        | Read the current user's deletion request receipt     |
| POST   | `/users/me/account-deletion-request`        | Submit a confirmed account deletion request          |
| PATCH  | `/users/me`                                 | Update own profile                                   |
| PATCH  | `/users/me/preferences`                     | Update own account preferences                       |
| GET    | `/users/me/preferences/workouts`            | Read own stored workout preferences                  |
| PATCH  | `/users/me/preferences/workouts`            | Partially update own workout preferences             |
| POST   | `/users/me/preferences/workouts/initialize` | Import explicit legacy values only into unset fields |
| POST   | `/users/me/avatar`                          | Upload/replace avatar                                |
| DELETE | `/users/me/avatar`                          | Remove avatar                                        |
| GET    | `/avatars/:key`                             | Public avatar retrieval                              |

## Account workout preferences

The authenticated GET and PATCH resource returns only
`{ autoRestTimer: boolean | null, restDurationSeconds: 60 | 90 | 120 | null }`
with `Cache-Control: no-store`. Null represents an uninitialized field. PATCH
accepts one or both non-null values, rejects unknown fields and empty patches,
and atomically updates only supplied fields for the active session owner.
No locale, profile, admin projection or device-local preference is modified.
The PostgreSQL check constraint also rejects unsupported duration values.
The authenticated POST initialization resource accepts the same non-empty
partial payload, but writes each field only if it remains NULL. It returns the
canonical stored values with HTTP 200 and no-store, including when nothing was
changed. A single transaction with conditional updates prevents a stale device
or retry from overwriting an explicit server choice; a normal PATCH always
wins over initialization for overlapping fields. Omitted fields remain untouched.
Clients must send only valid explicit legacy values, never synthetic defaults.
Client synchronization is still disabled; see the
[rollout contract](../../architecture/account-workout-preferences.md).

## Account deletion request intake (#297)

These routes use the `/users/me` URL namespace but belong to the separate [Account deletion requests module](account-deletion-requests.md). See that guide for confirmation, idempotency, security boundaries and remaining data-lifecycle work.

## Current capabilities (migration slice #291)

`GET /users/me/capabilities` returns `{ "athlete": boolean, "trainer": boolean, "admin": boolean }`. The authenticated user's identity comes from the server session/JWT, not query parameters; the flags are derived on each request from the **current DB role and TrainerProfile.isActive**, without exposing profile/audit records. The response is `Cache-Control: no-store`.

- `ATHLETE` accounts retain athlete access after trainer approval and after revocation. An active TrainerProfile adds trainer capability; a revoked profile always removes it.
- Legacy `TRAINER` accounts **without any TrainerProfile** temporarily retain trainer capability and gain athlete capability. A present inactive profile takes precedence and denies trainer capability.
- `ADMIN` remains isolated from athlete/trainer capability; the admin flag is informational, **not** an admin authorization token. Existing server-side operator permission checks remain required.
- Public `/users/me` and the legacy `role` field are unchanged. No role mutation, new RBAC table, public grant endpoint, or Prisma migration is needed for this slice (TrainerProfile is supplied by #309).

**Important:** These values allow UIs to explain access. They do not, by themselves, authorize protected trainer operations. Trainer Web routes now exist. Server-side resource policies and cross-product regressions remain mandatory; the capability response never substitutes for per-operation authorization.

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

## Auth persistence facade (Issue #360)

`UsersAuthFacade` in
`apps/api/src/modules/users/services/users-auth.facade.ts` is the
**public Nest provider** for the Auth module. `UsersModule` exports it,
and the Auth module imports `UsersModule`. It delegates the minimum
persistence operations needed for registration, credential verification,
password updates, JWT/session identity lookups, persisted mail locale
and email verification to the canonical `UsersRepository`.

Auth must not inject or import `UsersRepository` directly. The facade
does **not** store or expose secrets outside existing Auth consumers,
change account selectors, cache user roles, open transactions or implement
new password policies. The repository keeps email normalization, active
account checks, the JWT invalidation-time fence and existing error handling.
The earlier pure `users/public-api.ts` remains separate so consumers of
`deriveAccountCapabilities` do not import Nest provider code.

The architecture guard rejects cross-feature `UsersRepository` imports from both
Auth and Trainer–Athletes. `UsersModule` keeps the repository as a private
provider and exports only `UsersService` and `UsersAuthFacade`. The stale
Trainer–Athletes allowlist exception was removed in follow-up [#648](https://github.com/sauron9521/gym-platform/issues/648).
The public, pure `users/public-api.ts` capability contract remains available
without importing a Nest provider. Regression tests cover the Nest export
boundary, private import guard, Auth providers, mailers and credential flows.

Check controller, validation schema and OpenAPI for the current public profile field set. Do not return credential secrets. Avatar writes have additional throttling.

**Tests:** `src/modules/users/test/`, `test/e2e/users/users.e2e-spec.ts`, `test/integration/users/users.repository.integration.e2e-spec.ts`.

See [testing guide](../testing.md).
