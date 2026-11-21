# API performance baseline (Issue #313)

This first slice provides a **read-only, sequential HTTP sampling harness** for a
local API using disposable or synthetic test data. It captures reproducible
latency and decoded response sizes for four critical read paths. It does **not**
change HTTP contracts, Prisma schema, migrations, indexes or caching.

## Routes and fixture ownership

| Key                 | GET route                         | Why measure                          |
| ------------------- | --------------------------------- | ------------------------------------ |
| `users-me`          | `/users/me`                       | Authenticated user/profile read      |
| `workouts-summary`  | `/workouts?view=summary&limit=20` | Athlete workout list in compact view |
| `training-programs` | `/training-programs?limit=20`     | Accessible training program list     |
| `exercises`         | `/exercises?limit=20`             | Global/private exercise catalog read |

Use one **disposable PostgreSQL test dataset**, fixed account capabilities,
identical seeded row counts, and an unexpired bearer access token for that
account. Capture the dataset seed revision, API commit SHA, PostgreSQL version,
machine specification and configuration beside the report. Never put real user
records or a credential into committed artifacts.

## Local collection

Start a local API on `127.0.0.1:3001` backed by a **test** database. Obtain a
valid access token using the normal test login flow; supply it only through an
environment variable (never via a CLI argument). Do not run against production.

```sh
export API_PERF_BASE_URL=http://127.0.0.1:3001
export API_PERF_TOKEN='<test-account-access-token>'
pnpm perf:api:baseline > /tmp/gym-api-baseline.json
```

Defaults: **2 warmups + 25 recorded requests per route**, one concurrent
request, 150 ms pause between requests, ten-second timeout per request.
Maximum recorded samples: 40 per route. To target just one route, set
`API_PERF_ROUTES=workouts-summary`; comma-separated keys are supported.
Optional `API_PERF_SAMPLES`, `API_PERF_WARMUP`, and
`API_PERF_PAUSE_MS` control repetition and pacing. Non-200 HTTP responses,
including rate-limit errors, cause the run to fail without logging response
bodies. Only HTTP loopback origins are accepted; redirects are not followed.

Record a repeatable **before** report at a fixed git SHA and dataset. Apply
an optimization separately; collect an **after** report with the same token
role, database fixture, host, API settings and sampling options. Compare
route-by-route p50/p95 latency and body-size percentiles; do not compare
numbers obtained with different fixtures or warmup/concurrency settings.

Latency includes full response-body consumption (not just time-to-first-byte).
Response bytes are **decoded** payload bytes, not compressed network bytes.
Nearest-rank p95 uses the sorted sample at `ceil(0.95 * N)`; with only
25 samples it is still a coarse tail estimate, so treat early results as
exploratory rather than a statistically stable performance SLO.
JSON output has no tokens, response bodies, arbitrary URLs or user labels.

## Populated HTTP + Prisma query baseline (fifth slice)

The **test-only** PostgreSQL E2E suite measures the same four authenticated
GET requests with both HTTP wall-clock timing and Prisma query-event counts,
using **one sequential request window** per sample. The fixture consists of
one athlete, one legacy trainer, 128 planned workouts, 128 trainer programs
(with 128 draft versions) and 128 global exercises. Row payload shapes,
timestamps and list page sizes are fixed; randomly generated IDs prevent
collisions with parallel test runs. These are minimal synthetic rows, not a
realistic production dataset of exercise sets, translations or assignments.

The suite requires `TEST_DATABASE_URL` pointing to a disposable database whose
name ends in `_test` and the normal test Redis configuration. It inserts
fixtures before opening the measurement windows, checks the row counts, then
cleans up **only its own fixture IDs**, including dependent program versions
and authenticated test accounts. It does not truncate or reset shared tables.

From the monorepo root:

```sh
API_PERF_PROFILE_REPORT=1 pnpm --filter @gym/api exec vitest run --config vitest.config.e2e.ts test/e2e/infra/performance-query-count.e2e-spec.ts
```

Defaults: **2 warmups + 25 measured requests per route**, serial requests,
no extra pause between requests. The report line `API_PERF_PROFILE` contains
two separate, comparator-compatible JSON reports, `http` and `sql`, plus an
allowlisted fixture recipe and numeric row counts. An existing
`API_PERF_SQL_REPORT=1` flag remains available to print just the SQL report.
The API PostgreSQL E2E CI suite enables the combined report for review.

The HTTP samples include full-body response consumption and estimate decoded
payload bytes by re-serializing the parsed JSON body (the Nest JSON responses
use compact serialization). This is **not** a measurement of compressed
network bytes. The SQL counts include session/authentication queries, and
potential unrelated scheduled queries if any happen during a window. No raw
SQL, query parameters, cookies, response objects, account IDs or emails are
retained in either report. Production PrismaService and HTTP endpoints remain
unchanged.

Compared with the original two-account-only query-counter suite, this
populated fixture provides meaningful pagination pages for Workouts, Programs
and Exercises. It **does not** claim statistical performance baselines from
GitHub CI: runner contention, cache state and background tasks may vary, and
randomized fixture identifiers mean the database is not byte-for-byte
identical between independent runs. The HTTP loopback sampler above uses a
different protocol/session setup and must not be mixed into the same
request-level trace.

## PostgreSQL plan captures (third slice)

The dedicated `performance-explain.e2e-spec.ts` test runs **four fixed,
read-only SQL SELECT shapes** against a disposable PostgreSQL 17 database:
a current-user lookup, workout-summary list, trainer program list, and global
exercise list. The test creates two synthetic accounts and 128 workout,
128 program, and 128 exercise records inside an interactive Prisma transaction.
It runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, then deliberately **rolls
back the transaction**, including all fixture rows. It refuses any database
whose name does not end in `_test` before opening a connection.

To capture sanitized execution-plan evidence (from the repository root):

```sh
API_PERF_EXPLAIN_REPORT=1 pnpm --filter @gym/api exec vitest run --config vitest.config.e2e.ts test/e2e/infra/performance-explain.e2e-spec.ts
```

The report includes fixed route keys, plan node types, table/index identifiers,
row estimates/actuals, execution timing, and shared buffer reads/hits. It
**discards SQL conditions, raw SQL text, query parameters, UUIDs, email
addresses, and returned records**; report values do not include real test
credentials. The API E2E CI job enables this sanitized report in GitHub Actions logs.

These static SELECTs approximate key database access patterns; they do **not**
represent all joins, authorization filters, or nested Prisma queries from the
corresponding HTTP handlers. Fixture inserts are rolled back and PostgreSQL's
planner statistics remain sensitive to pre-existing data and ANALYZE history.
Use an isolated test DB and capture the schema revision, PG version, hardware,
seed configuration, and measured commit SHA beside any reported plan.
This is exploratory, not a stable query-performance SLO.

## Multi-thousand-row Exercises plan inspection (Issue #313)

The dedicated `performance-exercise-plans.e2e-spec.ts` uses a **different,
larger synthetic fixture** from the four-route HTTP and 128-row EXPLAIN tests:
2,048 active global exercises, 256 archived global exercises, 512 privately
owned athlete exercises, 2,048 exercise-to-muscle-group relations and 1,024
equipment relations. Rows have a mix of bench/squat names; the data includes
a single synthetic athlete and two synthetic muscle groups.

It captures eight **fixed, reviewed, read-only SELECT shapes** corresponding
to the exercise repository's global page/count, case-insensitive name
search page/count, muscle-group page/count, equipment-filtered page, and
athlete-visible page. It uses realistic pagination (`LIMIT 20`, one page
at `OFFSET 200`), presence/absence of archived entries, ownership scopes
and relation selectivity. It does **not** capture the raw nested Prisma SQL
projection or full HTTP authorization behavior and therefore is not a
precise route trace.

The suite requires `TEST_DATABASE_URL` with a `_test` database suffix.
All fixtures are created within a single PostgreSQL transaction, and the
test **always rolls back**, then asserts the synthetic exercise IDs and
athlete user are absent. PostgreSQL EXPLAIN runs against that uncommitted
population, without any database-wide `ANALYZE` or production
statistics modifications. The planner may still use stale existing
statistics; the snapshots are exploratory, not index design criteria.

To print allowlisted PostgreSQL plan metadata, with no raw SQL, bind
parameters, user identities, names or returned payloads:

```sh
API_PERF_EXERCISE_PLANS_REPORT=1 pnpm --filter @gym/api exec vitest run --config vitest.config.e2e.ts test/e2e/infra/performance-exercise-plans.e2e-spec.ts
```

The API PostgreSQL 17 CI E2E job enables this flag and emits
`API_PERF_EXERCISE_PLANS` in its test logs. Inspect plan node types,
estimated versus actual row counts, execution time and shared buffer
hits/reads together with the **pinned commit SHA**, PostgreSQL version,
fixture size and CI run ID. Do not mix these results with the existing
128-row EXPLAIN suite or interpret them as p95 HTTP benchmarks.
Before modifying indexes or adding caching, reproduce on an isolated
larger dataset with representative distributions and inspect each
affected SQL shape under realistic query conditions.

## Compare before/after captures

Use the [API performance comparison guide](performance-comparison.md) and
`pnpm perf:api:compare` to validate independent before/after capture bundles
before interpreting latency, Prisma query counts or SQL plans. The populated E2E suite captures
HTTP and query-count metrics from **the same request windows**, while EXPLAIN
is an independent synthetic SELECT experiment and must not be treated as
part of those traced HTTP requests.

For two-revision experiments, use the **manual**
[GitHub A/B workflow](performance-comparison.md#manual-two-revision-ab-workflow-opt-in).
It rejects incompatible fixture/schema revisions, creates two isolated local
PostgreSQL test databases on one runner, and compares hashes of actually
persisted synthetic fixture rows. An A/A run with the same SHA verifies only
the harness; it does not demonstrate a performance improvement.

## Remaining acceptance criteria

Issue #313 remains open for actual **before/after** SQL and HTTP measurements
under identically populated, realistic test fixtures, with explain-plan reviews
and a documented comparison before any query/index/cache optimizations.
Do not enable SQL query logging on production or include bound PII values in
reports. Do not add speculative indexes or caching based on exploratory numbers.

The API's existing `/internal/metrics` histograms are service-wide and
unlabeled (intentional privacy/cardinality design); they must not be
misrepresented as these per-route timings.
