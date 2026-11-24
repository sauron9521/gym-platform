# ADR-007 pilot evaluation — training program publication (CA05)

- **Status:** Evidence recorded; recommendation GO for limited expansion; explicit owner decision pending.
- **Date:** 2026-11-24.
- **Gate:** [CA05 #723](https://github.com/sauron9521/gym-platform/issues/723), [Epic #718](https://github.com/sauron9521/gym-platform/issues/718).
- **Decision standard:** [ADR-007](adr-007-pragmatic-clean-architecture.md).
- **Baseline:** [4407a2c](https://github.com/sauron9521/gym-platform/commit/4407a2cdeaddaa158c538a06cb584cd67753074d).
- **Merged pilot:** [b2a5afe3](https://github.com/sauron9521/gym-platform/commit/b2a5afe3191a666d5763c627992e860d707b9dea).
- **Final tested PR head:** [bde35894](https://github.com/sauron9521/gym-platform/commit/bde3589498346377838bb1d3bcc6d7e81ac3ae5f).

## Delivered and verified

| Stage | Merged PR                                                   | Evidence                                                                                                                                                          |
| ----- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA01  | [#729](https://github.com/sauron9521/gym-platform/pull/729) | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45386395551)                                                                                         |
| CA02  | [#731](https://github.com/sauron9521/gym-platform/pull/731) | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45388589008)                                                                                         |
| CA03  | [#733](https://github.com/sauron9521/gym-platform/pull/733) | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45393199997)                                                                                         |
| CA04  | [#736](https://github.com/sauron9521/gym-platform/pull/736) | [CI](https://github.com/sauron9521/gym-platform/actions/runs/45396151160), [Web integration](https://github.com/sauron9521/gym-platform/actions/runs/45396151287) |

The final CA04 run passed architecture, formatting, lint, typecheck, build, coverage, both PostgreSQL API shards, generated OpenAPI verification, Docker and the aggregate required gates. All four Web real-API integration shards passed. Unselected browser/mobile/admin/landing and vulnerability-audit jobs were skipped, not independently tested by this run. This is not a staging, Beta or production release approval.

## Structural comparison

Counts below are physical source lines (including comments and blank lines, excluding trailing blank lines) of four original production files and the four additional pilot files, at the pinned revisions. They are not whole-module LOC or a cyclomatic complexity benchmark.

| File or measure                                | Baseline | Pilot |
| ---------------------------------------------- | -------: | ----: |
| Legacy publication policy / HTTP mapper        |       33 |    15 |
| Version service (whole file)                   |      205 |   195 |
| Version repository (whole file)                |      375 |   378 |
| Feature module                                 |       61 |    67 |
| Pure domain policy and error                   |        0 |    50 |
| Application use case                           |        0 |    41 |
| Application port                               |        0 |    25 |
| Composition provider                           |        0 |    33 |
| Total physical lines                           |      674 |   804 |
| Production files in measured set               |        4 |     8 |
| Service publication method (included above)    |       23 |     7 |
| Repository publication method (included above) |      124 |   124 |

The measured source set grew by 130 lines (19.3%) and four files. The service method shrank by 16 lines, but the extracted application decisions still exist. This is an explicit boundary/testability tradeoff, not a code-size or total-complexity reduction. CA04's entire PR also includes documentation and tests (15 files, +422/-52); that diff is not directly comparable to the pinned production subset.

Before, publication policy directly imported Nest, and publication orchestration lived in the service importing Nest, Prisma and concrete repositories. After, domain has zero import declarations; use case has two inward imports (one type-only); port has one type-only inward import. There are zero Nest/Prisma imports in these three files. The outer version service still has Prisma imports for other scenarios; do not claim the entire module is framework-independent. The existing guard rejects outward edges, including aliases/type-only imports, and cycles in these opted-in inner folders. The composition factory is outside the guarded inner boundary and is exercised through actual Nest/HTTP tests.

The application port has three operations, not generic CRUD. Its generic result is opaque to the use case; the factory supplies the existing projection without duplicating the full snapshot model or converting Decimal/date fields. It retains legacy access exceptions as outer failures. The typed result is not a universal transport contract and the adapter should not be expanded into a generic abstraction.

## Regression and test evidence

Measured from the final [API coverage job](https://github.com/sauron9521/gym-platform/actions/runs/45396151160/job/138452650731) and [API shard 1](https://github.com/sauron9521/gym-platform/actions/runs/45396151160/job/138452650831), [API shard 2](https://github.com/sauron9521/gym-platform/actions/runs/45396151160/job/138452650819).

| Evidence                                |     Passed tests | Reported duration |
| --------------------------------------- | ---------------: | ----------------: |
| API coverage suite                      | 1684 (160 files) |           22.65 s |
| Pure publication use case               |                8 |             11 ms |
| Pure publication policy                 |               11 |              7 ms |
| HTTP error mapping                      |                5 |              9 ms |
| Version service                         |               31 |             14 ms |
| Publication integrity (real PostgreSQL) |                8 |            515 ms |
| Version repository (real PostgreSQL)    |               10 |            794 ms |
| Published versions (HTTP/PostgreSQL)    |                6 |           2014 ms |
| API E2E shard 1                         |   256 (35 files) |           80.03 s |
| API E2E shard 2                         |   266 (35 files) |           82.23 s |

The use-case test imports only inner code and uses a typed fake port, with no Nest container, database or Prisma dependency. It checks access failure, repeat access denial, archive/non-draft rejection, content validity, stale state, atomic invocation order, unchanged result identity and unexpected error propagation.

The [CA03 coverage job](https://github.com/sauron9521/gym-platform/actions/runs/45393199997/job/138442175120) reported 1674 tests across 159 files in 27.90 s, including 29 version-service tests (19 ms) and 11 policy tests (11 ms). CA04 adds eight independent use-case tests and two version-service tests. Training Programs line coverage moved from 98.09% to 98.13%; branch coverage from 93.56% to 93.81%. CA04 reports 97.80% statements and 98.58% functions. These are module-wide measurements, not proof of exhaustive coverage of every permission or race. The one production source absent from coverage is the type-only port, not a runtime branch.

These times are individual CI observations on different runs and commits, not a controlled repeated benchmark. No local or production performance measurement, runtime throughput claim, or causal speedup is established. Keep comparable repeated timings if performance becomes a deciding factor. Previous CA03 CI included an unrelated password reset timeout; CA03/CA04 also required formatting corrections. Green final runs do not erase that delivery friction.

## Transaction, authorization and API invariants

Compared the full repository publication method at the pinned baseline and merged pilot. After normalizing the three intentional error changes (unavailable exercises, rollback sentinel throw, rollback sentinel catch), the methods are text-identical. SQL, lock order and write predicates did not change.

- Draft row lock FOR UPDATE, authoritative re-read and pure policy validation, then exercise rows FOR SHARE in ID order.
- Source availability and trainer ownership constraints, conditional DRAFT transition, non-archived parent update and rollback retained.
- Real PostgreSQL tests cover concurrent publication (one winner), edit-first locked recheck, exercise archive-first race, unavailable sources and archived parent rollback.
- The factory preserves both fresh persisted capability/ownership reads, program-scoped version lookup, and the unchanged atomic write. The actor is carried through the application contract; the repository write still accepts existing program/version identifiers. No new claim of transaction-level capability revocation protection is made.
- Existing HTTP access, not-found/forbidden, conflict and bad-request semantics are preserved; the mapper handles only typed expected failures. Unknown Prisma errors retain the established global mapping. No automatic retries or new side effects.
- Final schema and generated OpenAPI gates passed. Existing projection, Date/Decimal semantics, controllers, facade and client contracts remain unchanged.

## Recommendation and limits

**Recommend GO for limited, incremental expansion, subject to explicit owner approval.** Independent business logic and typed tests justify the boundary in this complex write scenario. The extra four files, +130 source lines and factory/mapper composition are material overhead; do not reproduce them for trivial CRUD, read projections or mechanical folder migration.

Remaining debt and safeguards:

- Keep legacy Prisma update/draft creation paths until scoped. The duplicate fresh access reads are deliberate; do not optimize away access checks without separate evidence.
- The port mirrors only the required publication capability, but actor and status unions repeat a small vocabulary. Reassess ownership if shared pure types genuinely emerge; avoid creating a shared package just to remove duplication.
- The guard statically enforces imports and file cycles for the pilot, not every dynamic runtime injection pattern. Future scope expansion must be deliberate with positive/negative fixtures and actual DI integration.
- Exercise source validation stays infrastructure-side because it depends on authoritative locked rows; do not split the write or move validation out of the transaction.
- Retain targeted error mapping; do not catch all Prisma errors and relabel them conflicts.
- No new libraries, generic repository, global UoW, blanket CQRS or microservices. Existing product/release gates retain priority.

## Proposed expansion (not authorized yet)

1. [CA06 #724](https://github.com/sauron9521/gym-platform/issues/724): inventory remaining Training Programs version/assignment paths. Start with draft duration/update only if the invariant and concurrency/error boundary justify it; retain simple reads and small CRUD. Coordinate #366, #563 and #568.
2. [CA07 #725](https://github.com/sauron9521/gym-platform/issues/725): prioritize workout state transitions and set concurrency, reuse #329 and coordinate #344, #650 and #324. Do not duplicate existing mobile/revision or read-contract work.
3. [CA08 #726](https://github.com/sauron9521/gym-platform/issues/726): relationship termination/lifecycle, preserve access, transactional copies and event semantics.
4. [CA09 #727](https://github.com/sauron9521/gym-platform/issues/727): reconcile evidence and defer or integrate future complex cases through their existing product epics.

Each selected operation requires a small PR, a measured before/after inventory, typed independent tests where useful, real persistence regressions, contract parity and green CI. Stop or revise if a slice adds abstractions without benefit. No blanket conversion of the API.

## Owner decision gate

- **Decision:** PENDING — no authorization to start CA06–CA09.
- **Suggested decision:** GO with the limits above.
- Alternatives: REVISE the pilot before expansion; NO-GO (retain useful pure policy/guardrails, defer wider work).
- Record the owner's explicit decision in this evaluation and #723, then verify the documentation PR and close #723 only after the gate is satisfied. A documentation merge by itself is not an explicit GO.
