# ADR-007 expansion evidence — Training Programs (CA06)

- **Status:** Six implementation slices and final evidence [#752](https://github.com/sauron9521/gym-platform/pull/752) merged and verified; CA06 #724 closed.
- **Date:** 2026-11-24.
- **Gate:** [CA06 #724](https://github.com/sauron9521/gym-platform/issues/724), [Epic #718](https://github.com/sauron9521/gym-platform/issues/718).
- **Decision:** [ADR-007](adr-007-pragmatic-clean-architecture.md) and [CA05 owner GO](adr-007-pilot-evaluation.md).
- **Baseline:** [merged CA04 pilot](https://github.com/sauron9521/gym-platform/commit/b2a5afe3191a666d5763c627992e860d707b9dea).
- **Audited main:** [983b8521](https://github.com/sauron9521/gym-platform/commit/983b852163708a86db78f06255c35fae35e6c986).
- **Final tested implementation head:** [3d62c9be](https://github.com/sauron9521/gym-platform/commit/3d62c9beb3eec3c83ef33bde9a75a5b08026f115).

## Verified slices

All six selected implementation PRs are owner-merged. Their final CI and Web integration workflows completed successfully. The sequence is the implemented inventory, not a mandate to migrate every operation.

- [#740](https://github.com/sauron9521/gym-platform/pull/740): common pure duration predicate in draft update and publication, including the locked recheck. [CI](https://github.com/sauron9521/gym-platform/actions/runs/45402074264), [Web](https://github.com/sauron9521/gym-platform/actions/runs/45402074437).
- [#741](https://github.com/sauron9521/gym-platform/pull/741): narrow draft update command, pure normalization and adapter-side P2025 translation. [CI](https://github.com/sauron9521/gym-platform/actions/runs/45406407867), [Web](https://github.com/sauron9521/gym-platform/actions/runs/45406407903).
- [#745](https://github.com/sauron9521/gym-platform/pull/745): typed cloning conflict; move P2002 translation to the adapter. [CI](https://github.com/sauron9521/gym-platform/actions/runs/45409197766), [Web](https://github.com/sauron9521/gym-platform/actions/runs/45409194300).
- [#747](https://github.com/sauron9521/gym-platform/pull/747): assignment creation command and operation-specific P2002/P2025/P2003 translation. [CI](https://github.com/sauron9521/gym-platform/actions/runs/45411440276), [Web](https://github.com/sauron9521/gym-platform/actions/runs/45411440233).
- [#748](https://github.com/sauron9521/gym-platform/pull/748): explicit generic completion command/result, concurrent completion and replay test. [CI](https://github.com/sauron9521/gym-platform/actions/runs/45412633465), [Web](https://github.com/sauron9521/gym-platform/actions/runs/45412633061).
- [#750](https://github.com/sauron9521/gym-platform/pull/750): cancellation command and typed P2025 translation, concurrent cancellation/replay test. [CI](https://github.com/sauron9521/gym-platform/actions/runs/45415535463), [Web](https://github.com/sauron9521/gym-platform/actions/runs/45415535517).

## Structural inventory and tradeoff

Physical source lines (including comments and blank lines, excluding trailing blank lines) measured at the two pinned revisions:

- Version service: 195 to 173; assignment service: 299 to 291. Together 494 to 464 (-30).
- Version repository: 378 to 410; assignment repository: 500 to 536. Together 878 to 946 (+68).
- Publication policy: 50 to 52; shared training-program types: 94 to 92.
- Six new inner files: duration policy (11 lines), draft update (28), draft creation (7), assignment creation (22), completion (11), cancellation (14). Total 93 lines.
- Measured subset: 6 to 12 files, 1516 to 1647 lines (+131, approximately 8.6%). This is not a whole-module diff or a complexity benchmark. The baseline is the merged pilot, and unrelated changes between revisions are not attributed solely to CA06.

Both selected services have zero direct Prisma import declarations and zero isPrismaError calls/helpers in audited main. They still depend on concrete repositories, Prisma-derived payloads and Nest HTTP mapping; assignment read filters also retain repository-parameter types. This is targeted removal of write-error and input coupling, not ORM-independent services.

The existing publication use case and narrow port are retained. No additional use-case classes, DI factories, generic repositories or universal Unit of Work were added for these six slices. Application-owned commands and typed outcomes/errors are sufficient for their current complexity. The existing Training Programs domain/application import guard applies without a new exception.

## Final implementation CI evidence

The final [coverage job](https://github.com/sauron9521/gym-platform/actions/runs/45415535463/job/138520700114) ran 1704 tests in 162 files, all passing. Version service: 32 tests; assignment service: 54; facade integration at service level: 54; pure publication use case: 8; duration policy: 5; draft normalization: 3.

Training Programs coverage, comparing CA04 final job to CA06 final job:

- Statements: 97.80% to 97.89%.
- Branches: 93.81% to 93.98%.
- Functions: 98.58% to 98.63%.
- Lines: 98.13% to 98.22%.

CA06 inventory: 54 production sources, 52 represented in coverage; the two omitted files are type-only assignment-completion.ts and publish-program.port.ts. Counts and coverage are CI observations, not causal or performance claims.

Real PostgreSQL [shard 1](https://github.com/sauron9521/gym-platform/actions/runs/45415535463/job/138520700474) passed 260 tests in 35 files; [shard 2](https://github.com/sauron9521/gym-platform/actions/runs/45415535463/job/138520700447) passed 266 tests in 35 files. The four targeted suites account for 49 tests: version repository (12), assignment repository (10), assignment eligibility (19), publication integrity (8).

The final quality job passed architecture/runtime graph checks, formatting, lint, typecheck, affected workspace tests/build, Prisma schema and baseline validation. API Docker, tooling and both required API gates passed. All four real-API Web integration shards passed. Unselected browser, mobile, Admin, landing, Windows pre-push and vulnerability audit jobs were skipped; no independent claim about them.

Delivery friction was real: earlier slices required formatting repairs and #745 needed an outdated facade mock updated to the adapter contract. Final green runs are the evidence; no local or performance benchmark is claimed.

## Acceptance evidence

- Immutability: the locked draft update rechecks duration after a competing edit, a stale update cannot mutate a published snapshot, and the publication integrity suite covers competing publication and archive/edit-first races.
- Decimal precision: the version clone integration test compares all copied workout, exercise and set fields with decimal values represented by their exact strings, including weights, distances and RPE; original snapshot stays unchanged after draft edits. Existing projections are not rebuilt in application code.
- Assignment access: the eligibility and repository suites cover persisted trainer approval/revocation, athlete admin promotion, ownership, active relationship, exact program/version, source availability and restricted historical reads.
- Row locks and concurrency: parent clone lock, partial uniqueness, exercise/relationship/version/program/user/profile checks, conditional writes and rollback remain infrastructure-owned. The new completion and cancellation tests require one successful transition, one rejected competitor and unchanged winning timestamp/reason on replay. The duplicate assignment test verifies actual uniqueness and typed failure.
- API parity: typed write errors retain existing status and message mapping; unrelated errors remain unchanged. No schema, migration, new dependency, or deliberate transport contract change in the selected slices.
- Scope: all six selected implementation PRs merged with green final workflows. Final evidence document remains subject to owner review, docs CI and manual merge. Do not close #724 until that gate is verified.

## Explicitly deferred debt

- Keep simple CRUD, existing read filters/selects, DTOs, facade, compact read projections and their privacy rules in the existing outer architecture. Do not copy Prisma payloads just to remove a type dependency.
- Other Training Programs workout/exercise/set editing and access services still use existing framework/persistence patterns. The shared duration predicate is applied to the selected draft/publication paths, not claimed to cover every write path. Revisit individual mutations only with a demonstrated invariant or coupling benefit.
- Existing updateVersion and other broad repository helpers remain; do not introduce a generic abstraction or remove existing callers mechanically. Assess future narrowing independently.
- Preserve current authorization/locking semantics. The publication/draft paths do not gain a new transaction-level capability revocation guarantee from this refactor. Existing locked assignment checks remain authoritative.
- Keep expected error translation operation-specific; no blanket Prisma mapping or automatic retry. No new notifications, event emission, outbox or trainer UI work; coordinate #366, #563 and #568.
- Future Workouts work belongs to CA07 #725 and existing #329/#344/#650/#324; inspect current main and select justified operations. Do not begin before this evidence is merged and #724 reconciled. Existing release and security gates remain in force.

Recommendation: accept the limited CA06 implementation after the documentation review/merge gate. Continue the same pragmatic standard in CA07; the modest increase in files/lines is acceptable for explicit write boundaries, but do not scale this pattern mechanically.
