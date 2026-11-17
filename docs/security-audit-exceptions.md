# Production dependency audit: temporary exception

**Opened:** 2026-11-17
**Review no later than:** 2026-12-01 (or immediately when a patched picomatch release ships)
**Advisory:** [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
**Severity:** High — regular-expression denial of service (ReDoS).

## Why this exception is necessary

The `main` push workflows following Mobile PRs #218 and #219 fail in
`Dependency vulnerability audit`, which causes the final `Quality / Node 24`
aggregate gate to fail. The failing command is
`pnpm audit --prod --audit-level high`.

The audit report identifies `picomatch <=4.0.7`, reached transitively via
the Expo/React Native → Metro → Jest worker/tooling dependency chain. The
report states **Patched versions: None** as of 2026-11-17, so there is
currently no released version to upgrade to for this advisory. The
`pnpm-lock.yaml` did not change in the two merges; the issue is due to the
advisory being reported against an existing dependency, **not** code from
the Mobile rest-timer feature.

## Risk assessment and mitigation

The affected `picomatch` is used for Metro/Jest glob matching during
tooling/bundling, rather than to parse user-submitted workout titles or other
application input. The vulnerable path involves crafted, repeated extglob
patterns. **This does not prove that exploitation is impossible**: do not
pass untrusted glob patterns to Metro/Jest, and keep dev/bundler tooling
restricted to trusted project inputs.

This exception is limited to the single GHSA identifier in
`pnpm-workspace.yaml`:

```yaml
audit:
  ignore:
    - GHSA-fc5q-39xc-vjpf
```

It does **not** turn off `pnpm audit`, reduce the high-severity threshold,
or silence any other security advisory. The other moderate advisory remains
visible at its usual severity threshold.

## Removal criteria

1. Watch for a released `picomatch` version that fixes
   `GHSA-fc5q-39xc-vjpf` and confirm the advisory marks that version patched.
2. Update the affected transitive dependency/lockfile using the supported
   package manager; do not force incompatible Metro/Jest versions.
3. Remove **only** this GHSA from `audit.ignore`.
4. Run `pnpm install --frozen-lockfile` and
   `pnpm audit --prod --audit-level high`, followed by the CI matrix.
5. Keep the audit job as a required quality gate.

References:
- Advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf
- pnpm v12 audit config: https://github.com/pnpm/pnpm/blob/main/pnpm/docs/cli/audit.md
- Failed `main` after #218: https://github.com/sauron9521/gym-platform/actions/runs/44136029327
- Failed `main` after #219: https://github.com/sauron9521/gym-platform/actions/runs/44138740869
