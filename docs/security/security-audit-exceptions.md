# Dependency audit exception lifecycle

## Closed: picomatch GHSA-fc5q-39xc-vjpf (2026-11-21)

- [GitHub-reviewed advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) was **withdrawn on 2026-11-18** because the reported behavior was determined not to constitute a security issue.
- [PR #238](https://github.com/sauron9521/gym-platform/pull/238) introduced a temporary, narrow `audit.ignore` entry on 2026-11-17 while the advisory was active and no patched release was available.
- After the withdrawal, the specific ignore is obsolete; it has been **removed** from `pnpm-workspace.yaml`. Withdrawal is **not** a versioned security fix. This cleanup does not update `picomatch`, any transitive dependency, or `pnpm-lock.yaml`.
- The original risk rationale was a potential ReDoS involving attacker-controlled glob patterns in tooling dependencies. The withdrawn advisory is historical context, not an active vulnerability exception.

## Unchanged security gates

The following checks remain **blocking** in regular CI where dependencies are affected and in the scheduled dependency audit:

```bash
pnpm audit --prod --audit-level high
pnpm audit --audit-level critical
```

Other active High/Critical advisories must not be silently ignored. `scripts/security-audit-exceptions.test.mjs` guards removal of the withdrawn entry and continued presence of both audit commands in CI and scheduled workflows.

## Verification / future exceptions

1. Validate the GitHub advisory's withdrawn status against the source above.
2. On the branch, run `pnpm test:tooling`, `pnpm audit --prod --audit-level high`, and `pnpm audit --audit-level critical`.
3. Confirm **Dependency vulnerability audit**, **Quality / Node 24**, and **Web / Real API and PostgreSQL** succeed on this PR. Do not claim success from advisory withdrawal alone.
4. If the registry still reports a withdrawn advisory, investigate the registry response before adding any new exception; do not disable broad audit gates.
5. Any distinct, active advisory requires a new documented risk assessment with a narrow scope, owner/review date, and separate PR.
