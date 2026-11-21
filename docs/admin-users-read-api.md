# Admin Users read API — initial operator-only slice

Related: [#292](https://github.com/sauron9521/gym-platform/issues/292),
[#387](https://github.com/sauron9521/gym-platform/issues/387).

## Endpoint

`GET /admin/users` — **authenticated, read-only, no-store**.

The request must belong to a persisted `ADMIN` user whose UUID is explicitly
present in the validated server-only `SUPERADMIN_USER_IDS` operator allowlist.
The dedicated `admin.accounts.read` permission is denied to ordinary admins,
trainers, athletes, and anonymous clients. Never infer entitlement from a
browser-side flag, display role, or URL. This is a temporary operator bootstrap,
not granular staff-role authorization.

The endpoint is **not yet connected** to `apps/admin/users`: that UI must
keep its unavailable state until a separately reviewed server authorization and
pagination integration slice. The endpoint is not an invitation to call it from
an ordinary ADMIN session or expose its response in a browser cache.

### Query string

| Parameter     | Allowed values                                                | Default |
| ------------- | ------------------------------------------------------------- | ------- |
| `page`        | integer 1–10000                                               | 1       |
| `limit`       | integer 1–50                                                  | 20      |
| `search`      | 2–100 characters; case-insensitive substring of account email | none    |
| `role`        | `ATHLETE`, `TRAINER`, `ADMIN`                                 | all     |
| `status`      | `ACTIVE` only                                                 | ACTIVE  |
| `createdFrom` | ISO 8601 date-time with explicit offset                       | none    |
| `createdTo`   | ISO 8601 date-time with explicit offset                       | none    |

Unrecognized parameters, invalid statuses, excessive limits, and inverted
date ranges receive HTTP 400. Date boundaries are inclusive. Sorting is fixed
to `createdAt DESC, id DESC`. A page is capped at 50 records. Pagination uses
stable ordering with `skip`; frequent concurrent changes can still shift
offset-based pages, so this is not a transactionally frozen snapshot.

### Response

`200 OK`:

```json
{
  "data": [
    {
      "id": "d09c7567-626e-45d8-99f1-829ce4204fbd",
      "email": "example@example.test",
      "role": "ATHLETE",
      "status": "ACTIVE",
      "createdAt": "2026-11-21T12:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "skip": 0, "take": 20, "totalPages": 1 }
}
```

These values are purely illustrative, **not** live account information.

Only `id`, `email`, `role`, `createdAt`, and derived `status` leave
the server. Prisma `select` explicitly excludes credentials, soft-delete
metadata, tokens, session records, preferences, profile, medical and workout
details. Soft-deleted users are excluded at query time.

**Status caveat:** current `User` schema has `deletedAt`, but no
suspension lifecycle. `ACTIVE` is the only status emitted for non-deleted
users. Do not conflate soft deletion with suspension or silently expose a
`SUSPENDED` option until #293 implements real suspension semantics.

`401` for missing/expired authentication, `403` for no explicit operator
permission, `400` for invalid query, and `5xx` on unavailable persistence.
This endpoint logs a pseudonymized allowed-read audit event via the existing
logging-only `AdminAuditLogger`; it is **not a durable compliance audit log**.
Read access authorization is enforced by a route-level guard **after** NestJS
authentication attaches the user, reusing the existing server permission registry
and validated operator allowlist on every request. A global permissions guard
runs before route authentication; adding its decorator directly would deny all
valid requests.

## Read-only account details — `GET /admin/users/:userId`

For an existing non-deleted user, returns exactly seven keys: `id`, `email`,
`role`, `status` (derived `ACTIVE`), `createdAt`, `emailVerified`, and
`updatedAt`. Date fields are serialized as ISO 8601 strings. No profile,
biometrics, tokens, credentials, preferences, session data or soft-deletion
metadata is selected. Neither a separate staff role nor new database state is
created.

The same post-authentication `admin.accounts.read` operator allowlist is
rechecked independently for each detail request; the URL's account UUID does
not grant any authorization. UUID syntax is validated; malformed ID -> 400.
Missing, soft-deleted, or unknown users -> 404. Anonymous -> 401; valid
sessions without explicit Super Admin read permission -> 403 **even for
nonexistent users**. The response is uncached (`no-store`), read-only, rate
limited, and logs a pseudonymized allowed-read event on success only.

The Next.js `/users/[id]` page fetches this endpoint from a fixed
server-only API origin after independently validating the ADMIN session.
It rejects unexpected response fields before rendering, never runs a
browser-side privileged fetch, and hides all account data on authorization,
validation, network, or response-schema failure. Localized UK/EN read-only
display and a link back to the directory are provided. Any browser/staging
audit must verify cookie boundaries and actual operator access.

## Test and rollout gates

- Unit tests: strict Zod query; minimal Prisma select; permission-decorated
  controller and post-success audit record.
- HTTP + PostgreSQL E2E: anonymous 401, ordinary ADMIN / ATHLETE / TRAINER
  403, operator success, limit/page ordering, role/search/date filters, absent
  soft-deleted accounts and secrets, invalid 400, immediate permission revoke.
- Verify CI `API e2e / PostgreSQL 17`, `Quality`, and production build.
- **Keep #292 open** until actual account status lifecycle and final staging
  permissions/cookie security tests are verified. Directory and details
  read-only slices are implemented but do not authorize any mutations. Never merge without
  owner review; production Admin remains NO-GO pending staging evidence.
