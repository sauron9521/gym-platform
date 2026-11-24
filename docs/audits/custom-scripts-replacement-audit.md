# Self-written scripts: replacement and consolidation audit

**Baseline:** reviewed `main` at `31c043486e14a9961d7454f0125c19ddce53cd72`, 2026-11-24.
**Scope:** top-level `scripts/` inventory: **37 executable `.mjs` modules and 7 operational `.sh` scripts** (44 operational files), plus 59 test and contract files/scripts. App-specific scripts, `ops/` units and workflow inline scripts are **outside this exhaustive count**; review them separately before claiming repository-wide elimination.

## Executive decision

- **Do not bulk-delete custom scripts.** Many validate deployment provenance, digests, rollback evidence, host access and privacy boundaries. A general-purpose library does not reproduce these requirements.
- **P1: evaluate standard tooling in shadow mode, not as a gate replacement:** `ci-select.mjs` versus Turborepo affected/dry plans and/or `dorny/paths-filter`; `pre-push-checks.mjs` versus Husky + lint-staged + scoped Turbo tasks. Preserve fail-closed unknown paths, protected result jobs and Windows-safe filename handling.
- **P2: replace generic measurement/collection mechanisms selectively:** `api-performance-baseline.mjs` with k6/Autocannon/Artillery after route/fixture comparison; Docker log/resource acquisition with vetted collectors (Vector/Fluent Bit/cAdvisor) after host privilege, cardinality and privacy review. Keep domain-specific A/B evidence and sanitized exporters until parity is demonstrated.
- **Retain:** security-sensitive release, staging, backup, readiness and supply-chain validation unless the replacement explicitly enforces the same evidence and operator gates.
- **Already completed:** Knip (report only), Turborepo, Husky/lint-staged, dependency-cruiser import scanner cutover through PRs #691–#700. No new dependency is needed merely to repeat these audits.

## Complete top-level operational inventory (44 files)

Each item below is classified as **Candidate**, **Retain**, or **Review**. "Candidate" means evaluate a tool and prove equivalence; it does **not** authorize removal.

### A. CI, boundaries and local hooks (7 JavaScript)

- **Retain (direct replacement NO-GO):** `ci-select.mjs` — the [observed 2026-11-24 manual Turbo shadow audit](turbo-affected-shadow-evidence-2026-11-24.md) found that workflow/tooling-only changes require seven workspaces under our fail-closed policy but select none in Turbo's task graph. Consider only a policy-preserving hybrid after additional parity evidence; do not replace the required selector with `turbo --affected` alone.
- **Candidate:** `pre-push-checks.mjs` — ref parsing, path union and a command allowlist; current Husky and lint-staged already handle pre-commit formatting, while Turbo can run scoped workspace tasks. Do not replace Git ref semantics with staged-file semantics.
- **Retain:** `check-workspace-boundaries.mjs` — manifest names, forbidden application dependencies and shared-package cycles; the source import regex has already been removed.
- **Retain:** `ci-tooling-guard.mjs` — small safety contract for required GitHub status/result gates, not a generalized task runner.
- **Retain as thin diagnostic adapters:** `dependency-cruiser-named-imports.mjs`, `dependency-cruiser-relative-imports.mjs`, `dependency-cruiser-workspace-imports.mjs` — parsed source-import rules, unresolved targets and one-pass native reporting; standalone commands remain supported. Avoid another custom parser.

### B. API performance evidence (4 JavaScript)

- **Candidate:** `api-performance-baseline.mjs` — generic HTTP sampling and percentiles; compare k6/Autocannon/Artillery for reproducibility, warm-up, percentiles and CI artifacts.
- **Retain:** `api-performance-ab.mjs` — exact before/after source, fixture and response-fingerprint controls; a load tool alone does not prove comparable snapshots.
- **Retain:** `api-performance-compare.mjs` — project-specific baseline thresholds and comparison evidence.
- **Retain:** `api-performance-repeats.mjs` — reproducibility and repeated A/B validation; may consume native benchmark JSON later, but identity and safety checks must survive.

### C. Monitoring and exporters (7 JavaScript; 2 shell)

- **Candidate, privileged collector portion only:** `monitoring-docker-forwarder.mjs`, `monitoring-docker-resources.mjs`, `monitoring-docker-signals.mjs` — review Vector/Fluent Bit and cAdvisor or appropriate Prometheus exporters for Docker/cgroup data. Maintain the privileged/unprivileged boundary; never grant Docker socket access to the API or unprivileged monitor.
- **Candidate, aggregation portion only:** `monitoring-log-window.mjs`, `monitoring-report.mjs` — assess Loki/LogQL or Prometheus rules, but reproduce fixed five-minute windows, allowed event filters and the no-raw-identity policy.
- **Retain until telemetry parity:** `monitoring-textfile.mjs` — sanitized, bounded atomic textfile publication for node_exporter.
- **Retain:** `monitoring-backup-health.mjs` — project-specific backup freshness/readiness semantics.
- **Review operator wrappers:** `monitoring-collect.sh`, `monitoring-forward.sh` — candidates for systemd service `ExecStart` simplification only if privilege separation, path checks and failure codes remain identical.

### D. Release, production and backup integrity (8 JavaScript; 4 shell)

- **Retain:** `ghcr-promotion.mjs` — promotion preflight, remote digest verification and registry identity.
- **Retain:** `production-digest-guard.mjs` — immutable image and Compose identity checks.
- **Retain:** `production-host-preflight.mjs`, `production-host-preflight.sh` — host/operator validation, distinct from CI unit tests.
- **Retain:** `production-readiness.mjs` — evidence-based human GO/NO-GO, no automatic deployment.
- **Retain:** `production-release-origin.mjs` — provenance and release origin evidence.
- **Retain:** `release-bundle.mjs` — bundle integrity and verification; compare attestations/standard OCI distribution separately before changing its trust model.
- **Retain:** `release-ci-gate.mjs`, `release-supply-chain.mjs` — exact workflow/job and supply-chain evidence.
- **Retain:** `backup-production.sh`, `restore-drill.sh`, `verify-backup-freshness.sh` — operational database backup and restore safety; do not confuse pg_dump tooling with orchestration and validation.

### E. Staging, migrations and smoke checks (8 JavaScript; 1 shell)

- **Retain:** `admin-staging-preflight.mjs`, `admin-staging-target.mjs` — target validation and protection against live/incorrect environments.
- **Retain:** `api-migration-readiness.mjs` — migration and Prisma-specific evidence checks.
- **Review, not replace yet:** `staging-functional-smoke.mjs`, `staging-live-smoke.mjs`, `staging-smoke.mjs` — compare with existing Playwright/API test infrastructure, but preserve real target assertions, explicit opt-in and read-only checks where required.
- **Retain:** `staging-readiness-inventory.mjs` — staging evidence inventory.
- **Retain:** `staging-upgrade-rollback.mjs`, `staging-upgrade-run.sh` — release/rollback state transitions and guardrails.

### F. GitHub roadmap and project setup (2 JavaScript)

- **Review for one-time retirement:** `github-project-setup.mjs` — GitHub CLI/Projects setup. Verify actual callers and that setup is complete; manual project templates/actions may cover one-time configuration. Do not delete while replay/synchronization is required.
- **Review for managed sync:** `roadmap-milestones.mjs` — project phase mapping and issue assignment with GitHub CLI. A stock automation might schedule it; only remove after labels, duplicate handling, preview/apply and idempotence are proven.

### G. Mobile validation (1 JavaScript)

- **Retain:** `validate-mobile-smoke-inputs.mjs` — inexpensive safety checks on device-level test inputs; could share validation schemas in future, but no meaningful overhead saving justifies removing it.

**Shell accounting:** 2 monitoring + 4 release/backup/host + 1 staging = 7 operational shell scripts. Their matching `test-*.sh` scripts remain part of the test inventory, not this operational count.

## Recommended small-PR migration sequence

1. **P1 — affected-selection observation only.** The manual Tooling workflow includes a first-parent, one-commit comparison of `ci-select.mjs` with `turbo run lint typecheck build --affected --dry=json` in JSON artifacts. Extend real evidence for API, Web, Landing, Admin, Trainer, Mobile, API-client, shared UI/i18n/tokens, OpenAPI, lockfile, unknown path, docs-only and mixed changes. Record potential false negatives as blockers; optionally evaluate `dorny/paths-filter` separately. **Do not** change required CI routing or job names from this initial pilot.
2. **P1 — local hook feasibility.** Reuse Husky/lint-staged for formatting and compare Turbo scoped plans to `pre-push-checks.mjs`. Test first-push branches, multi-ref pushes, deletions, malformed stdin, missing merge-base, spaces and shell metacharacters on Windows. Preserve fail-closed full checks when uncertain.
3. **P2 — benchmarking adapter proof.** Keep the A/B evidence format and route fixtures unchanged; compare an established HTTP load tool's results, thresholds and exit behavior before replacing only the request/percentile loop.
4. **P2 — observability collector proof.** Evaluate vetted Docker/log/metrics collectors in a separate opt-in staging deployment with least-privilege review, whitelisted fields, redaction, freshness, no user identifiers and equivalent alerts. No production cutover in the audit PR.
5. **P3 — one-off GitHub/roadmap cleanup.** Trace exact callers of `github-project-setup.mjs` and `roadmap-milestones.mjs`; retire only confirmed unused workflows and retain reversible manual procedures.

## HTTP benchmarking tool evaluation (2026-11-24)

Reviewed baseline: [`712aa62`](https://github.com/sauron9521/gym-platform/commit/712aa62e3ddd9210d03a19d9541c455fdb425e74) (includes #793). Coordinates with #711 and #313. This is a source/documentation evaluation, not measured benchmark parity.

### Decision: retain baseline; prefer k6 for a future separate load profile

- **Autocannon — defer adoption.** The [Node HTTP/1.1 benchmark](https://github.com/mcollina/autocannon) is MIT-licensed and supports fixed request counts, connection/pipeline limits, warmup and rate controls. It is suitable for quick throughput probes, but histogram percentiles and throughput bytes are not the current report contract. A rate cap is not the same as a fixed pause after every fully consumed body. Adding it alongside k6 would duplicate tooling without a proven need.
- **k6 — preferred candidate for a separate opt-in load-testing spike.** [Scenarios](https://grafana.com/docs/k6/latest/using-k6/scenarios/) support fixed iterations and concurrent or arrival-rate workloads; [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) provide nonzero exits and metrics can be exported for Grafana analysis. It is a separate executable, not a Node package. The [AGPL-3.0 license](https://github.com/grafana/k6) requires review of intended use/distribution before adoption.
- **No direct replacement (both tools).** [k6 built-in metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) distinguish connection/blocking phases from request duration; `data_received` is not a decoded per-response size distribution. Its default percentile methodology is not established as identical to our nearest-rank calculation. Neither tool's native report should be relabeled as baseline schema v1.

### Preserve existing contracts

Keep `perf:api:baseline`, `perf:api:compare`, `perf:api:repeats`, the A/B workflow and all corresponding tests. The baseline is a sequential read-only sampler, not a load generator. It measures four allowlisted authenticated GET routes with one in-flight request, 2 warmups and 25 samples by default, a 150 ms post-request pause, a 10-second timeout, full decoded body consumption and exact nearest-rank p50/p95. The existing runner enforces loopback-only HTTP, no redirects, exact HTTP 200, bounded sample/warmup counts and sanitized output.

The compare, A/B and repeats scripts also validate project-specific provenance, persisted fixture fingerprints, response equivalence and independent attempts. Neither load tool replaces those responsibilities or the Prisma query/EXPLAIN evidence.

### Evidence gate for any future replacement

Use a disposable local test API/database and fixed synthetic actor, seed, schema, runtime and pinned API/tool versions. Do not benchmark real users, staging or production. Compare on the same host without competing workloads.

1. First exercise a synthetic HTTP fixture with ASCII and Unicode JSON, compressed responses, non-200, redirects, timeout and transport failure. Verify exact request counts, route ordering, warmup exclusion, post-body pacing, decoded byte counts, fail-closed status and redacted errors. Never log bearer tokens, response bodies or raw error details.
2. Then independently collect at least three paired runs for the four real allowlisted API routes with identical fixtures and options. Compare sample counts, nearest-rank percentiles computed from raw samples, timing boundaries, exact decoded bytes and observed overhead. Record versions, costs, variability and all mismatches. Do not invent a numerical tolerance or claim equivalence from a single run.
3. If a thin adapter cannot preserve the methodology without reimplementing the existing sampler, retain it. Any intentionally different methodology needs its own report schema and explicit comparator rejection of cross-method inputs.
4. For a separate k6 load profile, start with one VU and bounded iterations; extend concurrency only after an explicit test environment/rate-limit review. Disable redirects, require status 200, use fixed read-only routes, sanitize metrics/tags and keep thresholds exploratory until a measured service budget exists. Pin the executable/image, review the license/security and keep the job opt-in; do not add it to required PR checks or change API throttling.

No candidate binary was present on the checked local device; the local checkout also had unrelated changes and lagged remote main. No binary was installed and no real or synthetic load test was run. No dependency, lockfile, runtime, schema or CI change is authorized by this research. The next script-audit steps can proceed without waiting for a load-testing adoption decision; the empirical spike remains a separate follow-up under #711/#313.

## Final consolidation checkpoint (2026-11-24)

Reviewed [main `2fd97b8`](https://github.com/sauron9521/gym-platform/commit/2fd97b8f4429655ed932d7fe89287f907dd98ee8)
after #798 and #801. This closes the current **audit pass**, not the
implementation backlog, production readiness or #711. Preserve the earlier
inventory as historical evidence.

### Current inventory and caller verification

A complete tracked-path listing and literal filename reference search in a
fresh checkout found:

- Root `scripts/`: 38 non-test-named JavaScript modules and 7 operational
  shell scripts; 58 JavaScript test files and 3 shell test files. The 45
  non-test-named files include `ci-tooling-guard.mjs`, a shared test helper,
  rather than 45 independent operational commands. The new shadow comparator
  `ci-turbo-affected-shadow.mjs` is called by `tooling-audit.yml`.
- App and package `scripts/`: 18 non-test-named files (API 7, Mobile 5,
  Web 2, Landing 1, i18n 2, design-tokens 1). All have a manifest, workflow,
  module or documented operator reference.
- 16 tracked workflow YAML files, two Husky hooks, operational systemd units
  and shared Vitest helpers were also inspected for ownership and callers.
  File counts do not establish workflow activation, live deployment or usage.

Of the root modules, 41 have literal non-test code, manifest, workflow or
service references. Four exceptions require explicit interpretation:

- `check-workspace-boundaries.mjs` has architecture documentation and
  parity-test callers. Preserve its remaining manifest policy; assess overlap
  with the required dependency-cruiser graph gate before any retirement.
- `ci-tooling-guard.mjs` is imported by eight root contract test files.
  Keep it as a shared test helper, not an operator entrypoint.
- `github-project-setup.mjs` has documented manual preview/apply commands
  and tests; no automated caller was found. Retire only after the owner
  confirms that project setup/replay is no longer needed.
- `staging-readiness-inventory.mjs` has a documented manual evidence command
  and tests. Retain; no scheduled caller is required.

`roadmap-milestones.mjs` still has a tracked workflow caller. Do not delete
it or infer that the workflow is enabled from its presence on disk. Literal
reference search cannot prove absence of dynamic or external callers.

### Final dispositions by ownership

- **CI and hooks:** retain conservative `ci-select.mjs` and the Git-ref-aware
  pre-push planner. Husky, lint-staged, Prettier and Turbo handle standard
  orchestration; Turbo-only affected replacement remains NO-GO. Keep the
  shadow comparator advisory and retain the required result gates.
- **API boundaries:** keep the TypeScript AST parser for Nest-specific
  provider, DI and module conventions. Use dependency-cruiser for generic
  import graphs. Do not duplicate the parser or conflate the two rule sets.
- **API coverage and migrations:** retain source inventory/coverage adapters
  until native Vitest reports reproduce their missing-file and summary
  semantics; Prisma migration history and baseline verification enforce
  repository-specific invariants and should remain independent of the CLI.
- **API performance:** retain all four existing evidence scripts. Defer
  Autocannon; k6 is a distinct opt-in load-profile candidate, not a drop-in
  replacement. Follow the evidence gate above and #313.
- **Monitoring:** keep privileged collectors and sanitized output contracts
  until a Vector/Fluent Bit/cAdvisor pilot proves parity, redaction, host
  permissions and alert semantics. Preserve systemd ownership and backup
  freshness checks. No production collector change was tested.
- **Release, backup, staging:** retain all provenance, target, digest, restore,
  rollback and human approval guards. Evaluate shared validation functions
  only within a proven contract family. Do not unify distinct trust checks.
- **App tooling:** retain Web real-API E2E shards/runner, Mobile export and
  native preflight wrappers, Landing release preflight, i18n catalog checks
  and design-token generation. They encode application-specific platform,
  deployment or generated-artifact contracts. The shared Vitest Node and DOM
  helpers have real workspace consumers; keep those centralized.
- **Static checks:** actionlint, ShellCheck and zizmor already have an advisory
  workflow. Markdownlint is now a standard documentation lint command.
  Avoid adding a second equivalent scanner or promoting an advisory job
  without its own evidence and approval.

### Local verification

On the pinned clean checkout, the frozen pnpm install succeeded and the
following commands completed successfully:

- `pnpm test:tooling`: 399 tests in 58 files (24.61 seconds reported by Vitest).
- `pnpm --filter @gym/api test:architecture`: 101 tests in 3 files.
- `pnpm --filter @gym/api test:coverage-tools`: 9 tests in 2 files.
- `pnpm --filter @gym/api architecture:check` and `architecture:deps`.
- `pnpm architecture:cruise:boundaries`.

This is 509 JavaScript tests across three separate commands, plus three
architecture checks. It is not a benchmark comparison or full CI run.
The three standalone shell test scripts, native devices, live deployment,
backup/restore and telemetry parity were not exercised by these commands.

The [repeat Knip audit](../development/tooling-audit.md#repeat-audit-after-script-consolidation-2026-11-24)
in #798 measured 5 findings before its changes and 3 afterward, versus the
previous CI report's 83. Keep the two intentional Users public types and
track the one missing Expo dependency in #742; do not claim zero findings.
No additional Knip scan was run at this checkpoint.

### Organization and remaining work

Keep stable entrypoint paths for now. Root scripts are cross-workspace or
operator contracts; application-owned scripts stay in their application;
shared test/config adapters belong under `tooling/`; systemd and monitoring
configuration belong under `ops/`. This is an ownership convention, not
approval for a bulk move. A future move must update all callers, tests,
workflow path filters, runbooks and installed service paths in the same
reviewed migration.

Prioritize only evidenced gaps:

1. #742: SDK-compatible Expo SystemUI dependency and actual Android evidence.
2. #711 / #313: separate opt-in k6 spike if load testing is needed; no
   baseline cutover without measured parity.
3. #711 / #351 / #352: isolated collector evaluation only when staging and
   observability work is scheduled; preserve least privilege and privacy.
4. #711: review the manual GitHub project setup lifecycle with the owner and
   boundary/coverage adapter overlap if there is measurable maintenance cost.
5. #335: measure real CI runtime separately; no timing savings are inferred
   from code consolidation or a dry-run graph.

No files are deleted, moved, installed or disabled by this checkpoint PR.
Existing production and security gates remain unchanged. Further adoption,
retirement, actual deployment and issue closure require their owning evidence
and explicit review.

## Non-negotiable migration gates

- The **required** `Tooling contracts`, `Quality / Node 24`, `API e2e / PostgreSQL 17`, Web integration and release-source checks must retain their protected semantics; a green advisory workflow is not proof of parity.
- Security, host, production and staging validation is fail-closed. A new utility must not auto-write production state, remove human approval or log secrets.
- Node 24 / pnpm 12 / Windows shell behavior, real fixtures and generated Prisma/OpenAPI consumers must remain covered.
- Before deleting a script: identify all workflow, hook, package, docs and operator callers; prove equivalent success **and rejection** paths; run required tests; record migration and rollback instructions; obtain owner review/merge.
- This is a code/contract inventory, **not** a measured runtime benchmark or an assertion that alternative tools are drop-in compatible.

## Related references

- [Knip and Turborepo audit](../development/tooling-audit.md)
- [CI affected-workspace matrix](../development/ci-affected-workspaces.md)
- [Selective pre-push behavior](../development/pre-push-checks.md)
- [Dependency-cruiser boundary enforcement](../development/dependency-cruiser-pilot.md)
- [Opt-in production observability](../operations/production-observability.md)
- [Release and staging controls](../operations/release-ghcr.md)
