# Temporary security audit exception

## Tracking

- Advisory: [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
- Package: `picomatch` (High, ReDoS)
- Opened: 2026-11-17
- Review by: 2026-12-01, or immediately when a patched release becomes available

## Why the exception exists

The production dependency audit blocks push CI on `main` after PRs #218 and #219.
The failing command is `pnpm audit --prod --audit-level high`.

The affected package is pulled in by Expo / React Native / Metro / Jest tooling.
The audit reports `picomatch <=4.0.7` and **Patched versions: None**.
Neither merge changed `pnpm-lock.yaml`. The rest timer did not introduce this dependency.

The ReDoS requires crafted glob patterns. Metro and Jest use the affected dependency
for tooling, rather than parsing workout input. This is a reduced-exposure scenario,
**not** proof that exploitation is impossible. Only trusted project tooling should
be allowed to supply glob patterns.

## Restricted exception

The only ignored advisory in `pnpm-workspace.yaml` is:

```yaml
audit:
  ignore:
    - GHSA-fc5q-39xc-vjpf
```

The production audit still runs at the **High** threshold.
All other High and Critical advisories continue to fail CI.
Moderate findings remain visible at their normal threshold.

## Remove the exception

1. Verify that the advisory lists an available patched release.
2. Update compatible transitive dependencies and the pnpm lockfile.
3. Remove this GHSA from `audit.ignore`.
4. Run `pnpm install --frozen-lockfile`.
5. Run `pnpm audit --prod --audit-level high` and the full CI matrix.
6. Keep the dependency audit a required quality gate.

The exception must be reconsidered by 2026-12-01 even if no patch is available.
