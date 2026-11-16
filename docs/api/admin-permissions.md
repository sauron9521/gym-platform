# Administrative permissions — foundation

The API now contains a deny-by-default, server-side permission registry,
`@RequireAdminPermissions()` metadata decorator and a global
`PermissionsGuard`. Existing routes without the decorator remain unchanged.
This is infrastructure for future dedicated Admin controllers, not a complete
administration authorization product.

The existing Prisma role enum remains `ATHLETE | TRAINER | ADMIN`.
Only `ADMIN` receives `admin.console.read` from this registry; no
account-management, moderation, role assignment or audit-read permissions
are granted by default. Never authorize privileged API writes from a
client-side feature flag or from the admin UI alone.

Follow-up PRs must add an explicit SUPERADMIN persistence/assignment model,
per-account scoped permissions, admin sign-in and session strategy, audit-log
storage and API integration/e2e tests before any admin mutation endpoints
are enabled. A user merely possessing the existing `ADMIN` role must
not automatically become a super-admin.
