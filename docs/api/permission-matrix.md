# API permission matrix: current implementation (#288)

This is a **source-backed inventory** of selected HTTP permissions as
reviewed on 2026-11-23, including the Admin catalog boundary in PR #633,
the live Trainer grant check in PR #634 and persisted-capability enforcement
of exercise creation in this PR. This is **not** a completed authorization
audit or a new permission engine. Source code and server-side policy checks
remain authoritative.

## Principal and object rules

| Actor                | Current account capability      | Authorized object scope                              |
| -------------------- | ------------------------------- | ---------------------------------------------------- |
| Guest                | None                            | Public exercise catalog and taxonomy                 |
| Athlete              | `athlete`                       | Own workouts, exercises and relationships            |
| Approved trainer     | `athlete` + `trainer`           | Own athlete history; own programs and active clients |
| Revoked trainer      | `athlete`, no `trainer`         | Own history; limited relationship cleanup            |
| Admin                | `admin`, not `athlete`          | Explicit admin operations; global exercise catalog   |
| Allowlisted operator | Admin + scoped admin permission | Admin-purpose session and audited privileged route   |

Capabilities are derived from the **current persisted account**, not a JWT role
claim: [account policy](../../apps/api/src/modules/users/policies/account-capabilities.policy.ts).
An `ATHLETE` may also have an active TrainerProfile; a legacy `TRAINER` without
a profile retains compatibility. A revoked TrainerProfile overrides the legacy
role. `ADMIN` is not a general-purpose override for private Athlete data.
The `SUPERADMIN_USER_IDS` allowlist currently grants explicit elevated
administrative permissions; it does not create a separate automatic
`SUPERADMIN` role.

## Endpoint x capability x ownership

| Method / route group              | Permission / object predicate              | Enforcement                      |
| --------------------------------- | ------------------------------------------ | -------------------------------- |
| `GET/PATCH /users/me*`            | Own authenticated account                  | Users service + account ID       |
| `GET /users/me/capabilities`      | Own current capability snapshot            | Users service                    |
| `GET/POST/PATCH /workouts*`       | Athlete capability + own `athleteId`       | Workout service + repository     |
| `GET /exercises*`                 | Guest: global; account: owner/share policy | Exercise visibility SQL          |
| `GET /exercises/:id`              | Same visibility predicate as list          | Exercise `findById`              |
| `POST /exercises`                 | Live capability + optional explicit scope  | Exercise source policy           |
| `PATCH/DELETE /exercises/:id`     | Own custom or Admin-managed global only    | Management SQL + policy          |
| `/exercises/:id/trainer-access*`  | Explicit owner-controlled Trainer grant    | Trainer access service           |
| `/trainer-athletes*`              | Current participant + relation ownership   | Relationship service + SQL       |
| `GET /trainer-dashboard*`         | Current trainer + active client scope      | Dashboard service                |
| `/training-programs/:programId*`  | Active trainer + owned program             | Program access service           |
| `/training-programs/assignments*` | Athlete self or authorized trainer side    | Assignment read/write policy     |
| `GET /admin/users*`               | Admin-purpose cookie + `accounts.read`     | Origin/purpose/permission guards |
| `/admin/trainer-applications*`    | Admin-purpose cookie + `accounts.manage`   | Origin/purpose + service policy  |

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
   Exercise eligibility in Training Program Builder now uses the same fresh
   Trainer capability check, so an approved `ATHLETE`-role trainer can select
   global and own `TRAINER_CUSTOM` exercises, but a revoked legacy Trainer
   cannot select even a global exercise. Foreign and private Athlete exercises
   remain unavailable, and program draft ownership checks still apply.
4. **Live Trainer approval on exercise reads.** Shared Athlete exercises
   require an unrevoked grant, an `ACTIVE` collaboration, and currently active
   TrainerProfile (or a legacy `TRAINER` without a profile), all checked in the
   SQL read predicate. This protects against a revoked profile after the initial
   capability lookup. A legacy `TRAINER` also retains access to its own private
   `ATHLETE_CUSTOM` exercises. **Creation is now capability-checked** against
   the current account: `ADMIN` needs Admin capability for `GLOBAL`,
   `TRAINER` needs active Trainer capability for `TRAINER_CUSTOM`, and
   revoked legacy trainers fall back to `ATHLETE_CUSTOM`. The legacy role
   remains **only a default source preference**, not an authorization grant.
   Approved `ATHLETE`-role trainers still create personal exercises by
   default; `creationScope: "TRAINER"` explicitly creates `TRAINER_CUSTOM`
   only with current Trainer capability. `creationScope: "ATHLETE"` explicitly
   creates personal exercises, including for approved legacy `TRAINER` users.
   Invalid scopes fail schema validation; revoked Trainer scope returns
   `403` without a fallback write, and Admin cannot select personal scopes.
   Legacy clients omitting `creationScope` preserve their existing default.
   See the completed cross-product matrix [#361](https://github.com/sauron9521/gym-platform/issues/361).
5. **Admin session isolation.** The privileged Admin directory and Trainer
   review routes require an admin-purpose cookie and server-side permission,
   not merely a regular bearer token. Basic `ADMIN` does not imply
   `admin.accounts.read` or `admin.accounts.manage`.

## Verification and remaining acceptance

This PR adds optional `creationScope` to exercise creation, with strict
Athlete/Trainer capability checks, public schema validation, unchanged legacy
defaults, generated OpenAPI/client types and HTTP/PostgreSQL revocation tests.
The prior SQL-time trainer read eligibility is retained. Adding an exercise
to a program draft now takes a transactional User row lock plus an optional
TrainerProfile row lock, then reuses the canonical persisted Trainer
capability policy before its nested write. A PostgreSQL regression exercises
a stale positive preflight while a revocation transaction holds the rows;
the write must fail after the revocation commits. Other write paths, including
direct exercise creation, program set/workout edits and publication, still
need concurrency review, alongside cross-account fuzzing and further
resource-policy audit under
[#288](https://github.com/sauron9521/gym-platform/issues/288).
[#361](https://github.com/sauron9521/gym-platform/issues/361) is already closed;
do not reopen or duplicate its completed cross-product matrix.
**Keep #288 open**, and do not treat CI as production security approval.
