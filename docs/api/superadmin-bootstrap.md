# Operator-managed Super-admin bootstrap — temporary access policy

The current Prisma user role remains **ADMIN**. This change introduces **no**
new `SUPERADMIN` database role, account creation, UI permission editor,
delegated grants, or audit-log persistence.

## How the temporary elevated permission policy works

An authorized operator can configure `SUPERADMIN_USER_IDS` in the **private
API environment**, listing up to 20 **existing ADMIN account UUIDs**.
An empty or omitted value means nobody receives elevated permissions.
Malformed lists, unknown IDs, duplicates and mixed valid/invalid UUIDs
are rejected at startup or treated as an empty allowlist by the guard.

All current ADMIN users retain `admin.console.read`; only a user whose
authenticated server-side role is ADMIN **and** whose UUID is explicitly in
the validated operator allowlist may pass additional
`@RequireAdminPermissions(...)` checks. ATHLETE and TRAINER users cannot
be elevated by the list. Controller and handler requirements are cumulative.
No request header, browser role flag or untrusted JWT field may control this
allowlist. An allowlisted UUID never upgrades a user's stored role.

## Runbook (manual, operator only)

1. Verify the user is already a legitimate ADMIN through a trusted backend
   operator workflow; do **not** self-assign ADMIN through a public endpoint.
2. Set `SUPERADMIN_USER_IDS=<reviewed-existing-admin-UUID>` in the private
   API deployment configuration. Keep the setting out of client and public
   logs. A value containing invalid IDs causes the API configuration to fail.
3. Roll out the same reviewed configuration to all API replicas, restart,
   verify effective access and test an unrelated ADMIN, ATHLETE and TRAINER.
4. Revoke by removing an ID and restarting **all** replicas. For immediate
   compromise response, revoke active sessions in addition to the config
   change and confirm revocation with an explicit access test.
5. Record the operator change and approval in your protected change log
   until a durable, tamper-evident audit trail is available.

**Production readiness:** this policy only guards routes explicitly
annotated with `@RequireAdminPermissions`. It does not introduce admin
management endpoints. Implement persisted grants, scoped delegation,
audit logging, authorization E2E and safe role-provisioning in separate PRs.
