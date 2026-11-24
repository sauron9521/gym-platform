# ADR-007 expansion evidence — Workouts (CA07)

- **Status:** Eight implementation slices merged and verified; final evidence review and documentation merge pending.
- **Date:** 2026-11-24.
- **Gate:** [CA07 #725](https://github.com/sauron9521/gym-platform/issues/725), [Epic #718](https://github.com/sauron9521/gym-platform/issues/718).
- **Decision:** [ADR-007](adr-007-pragmatic-clean-architecture.md) and [CA05 owner GO](adr-007-pilot-evaluation.md).
- **Baseline:** [9790d95c](https://github.com/sauron9521/gym-platform/commit/9790d95c76b49b712719f76994a6ae3b17784d2b).
- **Audited main:** [2e777ca1](https://github.com/sauron9521/gym-platform/commit/2e777ca1405d6aa50a82fbb8ff5bdd7abbf7bf1f).
- **Final tested implementation head:** [d87b79c8](https://github.com/sauron9521/gym-platform/commit/d87b79c8388ac7b70249a37329cb60787a734bbc).

## Verified slices

All eight selected implementation PRs are owner-merged, with successful final CI and Web integration workflows.

| PR | Verified implementation | Final CI | Web |
| --- | --- | --- | --- |
| [#754](https://github.com/sauron9521/gym-platform/pull/754) | Workouts inner-layer import guard and seven regressions | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45422894133) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45422894172) |
| [#755](https://github.com/sauron9521/gym-platform/pull/755) | Native ESM shared domain runtime, API consumer and Docker import | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45425212609) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45425212516) |
| [#756](https://github.com/sauron9521/gym-platform/pull/756) | Canonical completion failure and locked set recheck | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45426505265) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45426505138) |
| [#757](https://github.com/sauron9521/gym-platform/pull/757) | Canonical cancellation preflight, all four states | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45428978559) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45428977584) |
| [#758](https://github.com/sauron9521/gym-platform/pull/758) | Start command and typed persistence conflict; rollback regression | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45431731198) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45431731237) |
| [#759](https://github.com/sauron9521/gym-platform/pull/759) | Completion command/result and typed conflict; concurrent completion | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45433100839) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45433100578) |
| [#760](https://github.com/sauron9521/gym-platform/pull/760) | Pure set normalization, narrow write data and typed conflict | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45434971710) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45434970471) |
| [#761](https://github.com/sauron9521/gym-platform/pull/761) | Keyed creation conflict boundary and scoped replay | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45436671882) | [Web](https://github.com/sauron9521/gym-platform/actions/runs/45436671673) |

## Structural inventory and tradeoff

Physical source lines, including comments and blank lines but excluding trailing blank lines, measured at the pinned baseline and audited main:

- Workouts service: 551 to 505 (-46).
- Creation repository: 295 to 295; lifecycle repository: 227 to 261; sets repository: 53 to 70; facade: 67 to 91.
- Shared workout types: 94 to 82.
- Four new application files: start (13), completion (18), set result (100), creation conflict (7). Total 138 lines, no imports.
- Selected subset: 6 to 10 files, 1287 to 1442 lines (+155, approximately 12.0%). Not a whole-module diff or complexity benchmark.
- Service-side direct Prisma error-code checks: five to one (P2025 four to one, P2002 one to zero). One Prisma import remains for outer CRUD, read filters, nested manual create and generic update. Prisma projections and concrete repositories remain intentional.
- Start/complete/cancel service preflights use the same transition table from @gym/domain; completion also uses its canonical invariant under the parent row lock. SQL predicates remain authoritative and are not redundant domain implementations.
- Inner contracts remain dependency-free. No new DI factories, use-case classes, generic repositories or Unit of Work. No new import exception for Workouts. API and Mobile share the native ESM package; Web adoption remains #329.

## Final implementation CI evidence

The final [coverage job](https://github.com/sauron9521/gym-platform/actions/runs/45436671882/job/138596439534) passed 1737 tests in 163 files. Workouts service (81), repository (37), command transaction boundaries (14), pure normalization (10), idempotency (9), decimal precision (11). Workouts coverage inventory represents all 24 production sources.

Comparison with the preceding [CA06 implementation coverage job](https://github.com/sauron9521/gym-platform/actions/runs/45415535463/job/138520700114) (1704 tests, 162 files; not a fresh run on the CA07 baseline):

- Statements: 89.54% to 91.10%.
- Branches: 84.51% to 85.81%.
- Functions: 86.92% to 89.57%.
- Lines: 90.00% to 91.67%.

Final real PostgreSQL [shard 1](https://github.com/sauron9521/gym-platform/actions/runs/45436671882/job/138596439555) passed 262 tests in 35 files; [shard 2](https://github.com/sauron9521/gym-platform/actions/runs/45436671882/job/138596439821) passed 266 tests in 35 files. Five targeted suites account for 99 tests: repository integration (33), HTTP (57), set capability revocation (4), creation capability revocation (3), management capability revocation (2).

Final quality, architecture, tooling, API Docker and required aggregate gates passed. All four real-API Web integration shards passed. Mobile and deployed native ESM compatibility were verified in #755; Mobile, other browser jobs, Windows pre-push and vulnerability audit were skipped by the final API-only affected selection. No fresh device QA, local execution, performance benchmark or release authorization is claimed.

Delivery friction: #755 and #758 required formatting repairs; #760 required both formatting and updating two direct integration callers with the now-required completedAt. Final green heads supersede earlier failed runs.

## Acceptance evidence

- Canonical rules: all selected lifecycle preflights and locked completion invariant share domain rules, and the package tests preserve error precedence. The pure set normalizer distinguishes omitted fields, null clears, zero and decimal values; skipped sets clear all performance fields.
- Persistence: start and completion transaction bodies retained, including exact locks and scoped conditional writes. The PostgreSQL start/cancel race verifies rollback of the assignment timestamp. Concurrent completion verifies a single winner and unchanged completedAt on replay. Existing stale-set and competing cancellation regressions continue to pass.
- Access: account capability callbacks, exercise archival checks, exact relationship/assignment scope, set ownership and workout parent locks retained; capability revocation and foreign-scope integration suites passed.
- Creation: SHA-256 request canonicalization unchanged. Manual and program creation share the keyed adapter error boundary; P2002 is translated after rollback. Winner lookup remains athlete-scoped and fingerprint-checked; no duplicate mutation retry. Missing winner propagates the original error. Existing concurrent same-key, cross-route and different-athlete HTTP tests pass. The reconciliation trigger is intentionally limited to the creation persistence boundary rather than arbitrary upstream errors.
- API parity: exact 400/409 messages preserved for selected cases; unexpected errors propagate. No database schema or migration change. No new external library; API gains the existing workspace domain dependency.
- All eight implementation PRs merged with verified final CI. The documentation PR is the remaining review/merge gate; close #725 only after verifying it.

## Explicitly deferred debt

- Keep simple CRUD and reads, concrete repositories, Prisma projections, nested manual create inputs, and generic planned-update/cancel helper (one direct service-side P2025 branch). Do not manufacture ports or duplicate payloads.
- No new capability revocation guarantees for start, complete or program creation; preserve existing authorization semantics. Set write callbacks remain transaction-bound and Prisma-typed at the outer boundary.
- #329 owns remaining Web adoption; #344 owns set revision/CAS and two-device conflict protocol; #650 owns exercise read contract; #324 owns device QA. Leave these issues open until their own acceptance evidence exists.
- No notification/event/outbox or release work. Continue CA08 #726 only after CA07 evidence review, merge and issue reconciliation; coordinate existing relationship/event backlog.

Recommendation: accept the targeted CA07 implementation after the documentation gate. The measured reduction in service-side ORM error handling and tested boundaries justifies the modest source growth; do not expand the pattern mechanically.
