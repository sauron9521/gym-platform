# Operator-owned super-administrator bootstrap

Until a durable delegated-grants model and audit log are approved, only an operator can designate elevated administrators using `SUPERADMIN_USER_IDS` in the private API environment.

- Accepts comma-separated **existing ADMIN user UUIDs** only; normal `ATHLETE`/`TRAINER` users are never elevated, even if present in the list.
- An unset list grants only `admin.console.read` to the current ADMIN role.
- The `PermissionsGuard` enforces both controller- and method-level requirements.
- Never expose or edit this allowlist via the admin UI. Production changes require a reviewed private configuration rollout and restart.

This is an **interim RBAC foundation**. It does not implement role assignment endpoints, mutable grants, super-admin account provisioning or an append-only audit trail. Do not describe it as a complete admin permission management system.
