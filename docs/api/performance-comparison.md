# Comparing API performance measurements (Issue #313)

Use the read-only `pnpm perf:api:compare` command to compare **before** and
**after** JSON measurements captured by the existing [API baseline tools](performance-baseline.md).
The tool compares the **same source** between commits; it never treats the
HTTP benchmark, SQL query-event counts and SQL `EXPLAIN` plans as one
synchronized request trace.

## Capture bundle format

Each input is a JSON object with `schemaVersion: 1` and `sources`. Include
one or more of `http`, `sql`, and `explain`. **The same sources must appear
in both files**. Each source has its own independent context and original
report, so SQL count and EXPLAIN may use different, clearly named fixtures.

A minimal **HTTP-only** bundle looks like this (replace the illustration
with genuine measurements; the script does not generate sample results):

```json
{
  "schemaVersion": 1,
  "sources": {
    "http": {
      "context": {
        "commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "fixtureKey": "fixed-seed-v1",
        "environmentKey": "isolated-host-node24",
        "dbSchemaKey": "schema-baseline-v1",
        "actorKey": "athlete-and-trainer-v1",
        "runtimeKey": "api-local-test-v1",
        "postgresMajor": 17
      },
      "report": {
        "schemaVersion": 1,
        "nodeVersion": "v24.22.3",
        "methodology": {
          "concurrency": 1,
          "warmupPerRoute": 2,
          "samplesPerRoute": 25,
          "pauseMs": 150,
          "latency": "elapsed time through complete response body read",
          "bytes": "decoded response body size, not network transfer bytes"
        },
        "results": [
          {
            "route": "users-me",
            "method": "GET",
            "path": "/users/me",
            "samples": 25,
            "latencyMs": { "min": 5, "p50": 8, "p95": 13, "max": 16 },
            "decodedResponseBytes": { "min": 120, "p50": 120, "p95": 120, "max": 120 }
          }
        ]
      }
    }
  }
}
```

The above numbers and SHA are **illustrative only**, not a Gym Platform
measurement. In an actual bundle, paste in the **whole unmodified** result
of `pnpm perf:api:baseline` as the HTTP `report` (all selected routes).
For a paired HTTP + Prisma capture, take `http` and `sql` from the
`API_PERF_PROFILE` JSON in the
[populated E2E suite](performance-baseline.md#populated-http--prisma-query-baseline-fifth-slice).
For a SQL-only capture, `API_PERF_SQL_REPORT` remains supported. The same
operator-provided fixture/environment context can be used **within each
source** for a genuine paired comparison, but this is not automatically
validated by the tool. For `explain.report`, use the JSON following
`API_PERF_EXPLAIN` in
the [EXPLAIN E2E](performance-baseline.md#postgresql-plan-captures-third-slice)
logs. Strip the log prefix and use the JSON object itself; do not copy log
timestamps or incidental test output. Never paste authentication tokens,
request bodies, raw SQL conditions, or production data into bundles.

## Required provenance for each source

The `context` is entered by the operator **per source**, not automatically
inferred from logs. Record actual values, never placeholder labels:

- `commit` — full 40-character Git SHA of the measured API, different for
  before and after if the code changed.
- `fixtureKey` — a versioned identifier for an _identical dataset recipe and
  size_; different probes may legitimately have different fixture keys.
- `environmentKey` — hardware/runner and isolation profile, kept the same
  for both measurements.
- `dbSchemaKey` — schema/migration version; must match, so index migrations
  require a separately reviewed, explicitly documented experiment.
- `actorKey` — roles, capabilities and tested principal configuration.
- `runtimeKey` — API configuration/profile, including feature flags.
- `postgresMajor` — PostgreSQL major version (integer, e.g. 17).

Keys are short, alphanumeric labels with `_.:-` allowed; don't insert emails,
paths, passwords or other sensitive strings. Each **before/after pair within a
source** must match on every field except `commit`. HTTP Node version, route
method and path, warmup/sample counts, concurrency and pacing must also
match. SQL event counting methods and EXPLAIN fixture sizes must match.
The tool rejects missing, duplicate and unknown routes, invalid metrics and
incompatible report schemas. Matching operator-provided labels **does not
prove** that two independently seeded databases contain identical rows.

## Run the comparison

From the monorepo root, after creating two actual, independently captured
bundle files:

```sh
pnpm perf:api:compare /tmp/before.bundle.json /tmp/after.bundle.json > /tmp/comparison.json
```

The output contains only recognized route keys, two verified Git SHAs, and
numeric before/after values, absolute deltas and percentage changes.
Negative deltas mean the measured value became lower, which is not always
an improvement (for example, smaller responses can indicate missing data).
If the before value is zero, the percent change is `null` rather than
an invented percentage. No fixture labels, SQL text or response bodies are
copied to the result.

Only the following metrics are compared:

| Source             | Metrics                                                          |
| ------------------ | ---------------------------------------------------------------- |
| HTTP               | p50/p95 full-body latency (ms), decoded response bytes           |
| Prisma SQL         | p50/p95 SQL statement events per serialized request              |
| PostgreSQL EXPLAIN | statement planning/execution time (ms), shared buffer reads/hits |

Interpret SQL `EXPLAIN` separately: those are fixed SELECT shapes, not the
complete HTTP request's join tree. Compare each metric within **its own**
source and fixture only. An E2E suite run in GitHub Actions is a functional
gate, **not** a statistically controlled A/B benchmark. Never interpret
a single short sample, small synthetic dataset, or divergent hardware as
proof of a performance gain.

## Targeted PR A/B, harness A/A, and manual two-revision A/B

A same-repository PR changing the benchmark workflow, comparison
script/tests or populated E2E fixture normally runs **A/A**: identical
pinned PR head SHA twice, verifying the infrastructure without claiming
a performance improvement.

For a focused SQL optimization, a PR whose branch starts with
`perf/` and changes
`apps/api/src/modules/exercises/repositories/exercises.repository.ts`
automatically performs a genuine **base-vs-head A/B** instead. The
two full SHAs are pinned by the GitHub PR event. The immutable fixture,
schema, migration and lockfile compatibility gate still applies; if
any differs, the job fails closed. This is intentionally scoped to one
repository file, not every application change. Since CI runners are
not statistically controlled laboratories, even real A/B deltas remain
exploratory and must be interpreted alongside unchanged response bytes,
SQL counts and repeated measurements. In particular, **fewer SQL events
are not evidence of lower HTTP tail latency**. PR #549 was closed unmerged
because its genuinely paired measurements reduced Exercises queries 12→11
but the latest serial candidate's p95 varied in direction across three runs
(−5.8%, +22.5%, +18.2%). Record at least three independent runs with the
same fixture fingerprints and inspect the range and direction of p95 changes;
if tail latency appears worse or inconsistent, do not claim a performance
gain. These few runs are still not a statistical significance test.

Ordinary application PRs do not run this expensive benchmark.
Fork pull requests cannot run this job; the job has **read-only repository
permission**, and the databases are separate local disposable PostgreSQL 17
services. Only the numeric sanitized comparison is uploaded.

The workflow also retains explicit manual two-revision mode. Once merged
into `main`, open **Actions →
API Performance / PR A-A or A-B and manual comparison → Run workflow** on `main`.
Supply two **full 40-character commit SHAs** (`before_sha` and
`after_sha`). GitHub runs the two checkouts sequentially on the **same
Ubuntu 24.04 runner**, Node 24 and PostgreSQL 17 service.

The workflow deliberately refuses mismatched versions of the A/B
fixture test, Vitest configuration, Prisma schema or migrations,
Prisma configuration, API package manifest or pnpm lockfile. This
makes it suitable for comparing an isolated implementation change,
not different schemas/dependencies. **Both revisions must already
contain the same A/B fixture test introduced after PR #546.**
Comparing a revision from before the harness was added will be rejected.

Each checkout gets its own freshly created, distinct disposable local
PostgreSQL database: `gym_perf_before_test` and
`gym_perf_after_test`. There is **no seed library or production data
import**. The test enables deterministic fixture IDs only when its
database name and loopback connection match those dedicated A/B
names. This makes the synthetic records (128 workouts, 128 programs
and versions, 128 global exercises and two users) reproducible
between the two databases. The test hashes its **persisted** selected
fixture rows and reports a SHA-256 fingerprint without exposing
account IDs or raw records. If fingerprints differ, the comparison
fails closed.

Both revisions independently run 2 warmups and 25 serialized
GET measurements per route; the workflow extracts only the allowlisted
`API_PERF_PROFILE` contents from test logs. The runner validates
report schemas, routes, samples, actual fixture fingerprints and
pinned Git SHAs, and produces a `comparison.json` artifact using
the existing comparator. It never uploads raw test logs, SQL
conditions, payloads, session cookies or token data. The artifact is
retained for **7 days**.

The `comparison.json` file provides HTTP p50/p95, decoded response
bytes and Prisma query count deltas for Users, Workouts, Training
Programs and Exercises. It now also contains a privacy-safe
`responseEquivalence.exercises = "identical-serialized-json"` verdict,
which is emitted **only after the validator confirms** matching SHA-256
fingerprints of the **actual serialized JSON bodies** of
`GET /exercises?limit=20` from the two isolated A/B databases.
Within each revision the benchmark asserts that all 25 recorded
Exercises responses have the same SHA-256; unstable responses fail the
test before comparison. Raw responses, IDs, parameters, cookies and
tokens are **never included** in artifacts. The digest itself is used
only by the private comparison step and is not copied to
`comparison.json`.

The hash is calculated from the exact `JSON.stringify(response.body)`
representation and is intentionally strict: key order changes may
also cause a mismatch, even when JSON objects would be semantically
equivalent after key sorting. This fail-closed behavior catches content
changes that **decoded byte length alone cannot detect**. It only
covers the **Exercises** route under the synthetic benchmark dataset,
not the other three measured routes or every authorized visibility
condition. Existing decoded-byte comparison is retained for all routes.
A/A (same-revision) runs establish the equivalence-check pipeline;
genuine A/B runs need different pinned code revisions and repeated
measurements. Historical reports without this digest are incompatible
with the upgraded A/B validator and cannot be used to assert response
equivalence retroactively.

It does **not** include EXPLAIN: that probe
uses a different SQL-shape experiment. A run with the **same SHA
for before and after** is labeled `A/A pipeline smoke`; it verifies
the measurement pipeline but does not measure a code improvement.

**Limitations:** a runner is not a laboratory (warm CPU and cache
effects, transient host load and service-level scheduling can still
influence timing). Even with identical fixture hashes, auth/session
internals are generated separately in each DB, and one pair of
25-sample runs does not show statistical significance. Treat
results as exploratory evidence; repeat runs and examine full
SQL plans before considering indexes or caching. The workflow
does not change, deploy, or migrate any live database.

## Repeated A/B summary: minimum three independent attempts

The CI workflow still produces **one paired comparison per run attempt**.
For a real `perf/*` PR, run the same pinned A/B job and use GitHub
Actions **Re-run jobs** at least twice more without changing either commit.
Each new `comparison.json` automatically includes the GitHub Actions
`run.githubRunId` and `run.githubAttempt` supplied by the runner.
A/A comparisons cannot be used as evidence of an implementation improvement.

Download and extract each attempt's **sanitized** `comparison.json`
artifact, keeping each one in a separate file before its 7-day expiry.
The artifacts are ZIP archives; the CLI consumes extracted JSON, not ZIP:

```sh
pnpm perf:api:repeats /tmp/ab-attempt-1.json /tmp/ab-attempt-2.json /tmp/ab-attempt-3.json > /tmp/ab-repeat-summary.json
```

The read-only script `scripts/api-performance-repeats.mjs` accepts **3–12**
paired reports, fails closed on missing/duplicate GitHub run-attempt IDs,
A/A results, changed before/after full commit SHAs, different persisted
fixture SHA-256 fingerprints, missing/duplicated/unknown routes or metrics,
inconsistent numeric deltas and changed decoded response sizes (including
drift **between** attempts). It only emits recognized route/metric names,
commit SHAs, run-attempt identifiers, numeric summaries and an interpretation
caveat. It never outputs input payloads, raw SQL, cookies, tokens or paths.

For each route, the report records the **median across attempts** of
the measured before/after HTTP p50 and p95, the **median/min/max of paired
percentage deltas**, counts of lower/higher/unchanged attempts, and the
directional consistency. It also summarizes Prisma query-count p95
and checks the decoded response p95 byte count. Direction labels like
`consistently-lower` are **descriptive, not pass/fail gates or statistical
confidence claims**. Do not automatically approve a PR merely because
all three readings are lower; repeat with larger representative fixtures,
check p95 variability and review the relevant SQL plans.

Older A/B artifacts created **before this provenance extension** lack
an Actions run ID and attempt number. They remain valid historical
observations but deliberately **cannot** be combined by this strict
independence-checking CLI. Record those results in Issue #313 separately
rather than inventing run metadata.

## Issue completion

Issue #313 remains open until we capture real before/after results on
controlled populated fixtures, review the plans and the full REST/Prisma
query behavior, and document evidence supporting or rejecting a proposed
optimization. This comparator **does not change production API, schema,
indices, caches or runtime telemetry**.
