# API permission matrix: current implementation (#288)

This is a **source-backed inventory** of selected HTTP permissions on `main` as
reviewed on 2026-11-23, plus the narrow Admin exercise-read correction in this
PR. It is **not** a completed authorization audit or a new permission engine.
Source code and server-side policy checks remain authoritative.

## Principal and object rules

| Actor | Current account capability | Authorized object scope |
| --- | --- | --- |
| Guest | None | Public exercise catalog and taxonomy |
| Athlete | `athlete` | Own workouts, exercises and relationships |
| Approved trainer | `athlete` + `trainer` | Own athlete history; own programs and active clients |
| Revoked trainer | `athlete`, no `trainer` | Own history; limited relationship cleanup |
| Admin | `admin`, not `athlete` | Explicit admin operations; global exercise catalog |
| Allowlisted operator | Admin + scoped admin permission | Admin-purpose session and audited privileged route |

Capabilities are derived from the **current persisted account**, not a JWT role
claim: [account policy](../../apps/api/src/modules/users/policies/account-capabilities.policy.ts).
An `ATHLETE` may also have an active TrainerProfile; a legacy `TRAINER` without
a profile retains compatibility. A revoked TrainerProfile overrides the legacy
role. `ADMIN` is not a general-purpose override for private Athlete data.
The `SUPERADMIN_USER_IDS` allowlist currently grants explicit elevated
administrative permissions; it does not create a separate automatic
`SUPERADMIN` role.

## Endpoint x capability x ownership

| Method / route group | Permission / object predicate | Enforcement |
| --- | --- | --- |
| `GET/PATCH /users/me*` | Own authenticated account | Users service + account ID |
| `GET /users/me/capabilities` | Own current capability snapshot | Users service |
| `GET/POST/PATCH /workouts*` | Athlete capability + own `athleteId` | Workout service + repository |
| `GET /exercises*` | Guest: global; account: owner/share policy | Exercise visibility SQL |
| `GET /exercises/:id` | Same visibility predicate as list | Exercise `findById` |
| `POST /exercises` | Role-selected global/custom source | Exercise source policy |
| `PATCH/DELETE /exercises/:id` | Own custom or Admin-managed global only | Management SQL + policy |
| `/exercises/:id/trainer-access*` | Explicit owner-controlled Trainer grant | Trainer access service |
| `/trainer-athletes*` | Current participant + relation ownership | Relationship service + SQL |
| `GET /trainer-dashboard*` | Current trainer + active client scope | Dashboard service |
| `/training-programs/:programId*` | Active trainer + owned program | Program access service |
| `/training-programs/assignments*` | Athlete self or authorized trainer side | Assignment read/write policy |
| `GET /admin/users*` | Admin-purpose cookie + `accounts.read` | Origin/purpose/permission guards |
| `/admin/trainer-applications*` | Admin-purpose cookie + `accounts.manage` | Origin/purpose + service policy |

The table groups related routes; each mutation still has its own state and
ownership requirements. For example: program draft mutation requires a **DRAFT**
version owned by the trainer; assignment creation requires a **PUBLISHED**
version and an **ACTIVE** relationship; the assigned Athlete alone completes
an assignment; relationship `accept`/`decline` require the recipient;
`cancel` requires the initiator. Former trainers only receive restricted
relationship/assignment projections after revocation. See
[Workout policy](../../apps/api/src/modules/workouts/policies/workout-access.policy.ts),
[TrainerAthlete service](../../apps/api/src/modules/trainer-athletes/services/trainer-athletes.service.ts)
and [Program access](../../apps/api/src/modules/training-programs/services/training-program-access.service.ts).

## Explicit denies and priority risks

1. **Admin cannot enumerate private exercises.** `GET /exercises` and
   `GET /exercises/:id` use `source = GLOBAL` for `ADMIN`, not an
   unrestricted `{}` predicate. Admin remains able to create/manage
   **global** exercises. A future private-content moderation workflow
   requires a distinct, audited permission and purpose, never a role-wide
   bypass.
2. **Foreign custom exercises are not writable.** A foreign custom ID returns
   `404`, while a known global ID returns `403` to a non-admin writer.
   This distinction follows the existing anti-enumeration policy.
3. **No role-based Trainer escalation.** Workout and program/relationship
   flows use current account capabilities; Trainer work must not become
   available through stale role claims, inactive profiles or an Admin cookie.
4. **Known legacy risk: exercises.** The exercise source/visibility policy
   still switches on `User.role` instead of the derived Trainer capability.
   Thus an approved `ATHLETE` with TrainerProfile can follow the
   `ATHLETE_CUSTOM` branch. Audit and migrate this separately with
   [#361](https://github.com/sauron9521/gym-platform/issues/361), preserving
   existing Athlete-owned private exercises and explicit Trainer grants.
5. **Admin session isolation.** The privileged Admin directory and Trainer
   review routes require an admin-purpose cookie and server-side permission,
   not merely a regular bearer token. Basic `ADMIN` does not imply
   `admin.accounts.read` or `admin.accounts.manage`.

## Verification and remaining acceptance

This PR changes **only** the Admin exercise catalog read predicate and unit
tests for list/detail queries; it does not alter session issuance, Admin
moderation, Prisma schema, API response shape or other exercise permissions.
The existing Exercise HTTP/PostgreSQL suite and current authorization tests
must pass on this PR. Tests for role transitions, BOLA/IDOR, active-grant
revocation, cross-account access and dual-capability Trainer workflows are
still needed for full [#288](https://github.com/sauron9521/gym-platform/issues/288)
and [#361](https://github.com/sauron9521/gym-platform/issues/361) acceptance.
**Keep #288 open** after this first slice and do not treat CI as production
security approval.
