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

## Test and rollout gates

- Unit tests: strict Zod query; minimal Prisma select; permission-decorated
  controller and post-success audit record.
- HTTP + PostgreSQL E2E: anonymous 401, ordinary ADMIN / ATHLETE / TRAINER
  403, operator success, limit/page ordering, role/search/date filters, absent
  soft-deleted accounts and secrets, invalid 400, immediate permission revoke.
- Verify CI `API e2e / PostgreSQL 17`, `Quality`, and production build.
- **Keep #292 open** until secure Admin UI wiring, details API and true
  status operations are separately implemented/tested. Never merge without
  owner review; production Admin remains NO-GO pending staging evidence.
