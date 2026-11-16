# Administrative permissions — foundation

The API now contains a server-side, deny-by-default permission registry,
`@RequireAdminPermissions()` metadata decorator and a global
`PermissionsGuard`. Existing routes **without** the decorator remain
unchanged. This is infrastructure for future dedicated Admin controllers,
not a complete administration authorization product.

The existing Prisma role enum remains `ATHLETE | TRAINER | ADMIN`.
Only `ADMIN` receives `admin.console.read` from this registry; no
account-management, moderation, role assignment or audit-read permissions
are granted by default. Never authorize privileged writes using only a
client-side feature flag or the admin UI.

## Guard behavior

- Controller-level and handler-level requirements are **cumulative**.
  A handler cannot replace or weaken requirements declared on its controller.
- An empty or malformed permission annotation fails closed. The absence of
  annotations preserves the authentication behavior of existing endpoints.
- Every requested permission must be granted to the authenticated request
  actor; missing or unknown roles and permissions are rejected.

**Important:** This foundation adds no live Admin routes. Before enabling
any Admin endpoint, add API integration/e2e tests proving that authentication
populates the request actor *before* the permission check in Nest's guard
order (global guards run before controller/method guards). Protected
endpoints must not depend solely on the UI or a class-level
`@Authenticate()` decorator without that verification.

Follow-up PRs must add an explicit SUPERADMIN persistence/assignment model,
per-account scoped permissions, admin sign-in and session strategy, audit-log
storage and API integration/e2e tests before any admin mutation endpoints
are enabled. A user merely possessing the existing `ADMIN` role must
not automatically become a super-admin.
