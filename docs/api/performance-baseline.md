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

## Prisma SQL query counts (second slice)

A dedicated **test-only** PostgreSQL E2E suite measures the number of SQL
statement events emitted by Prisma for the same four read routes. It creates
two throwaway accounts (athlete and trainer), authenticates through the normal
session flow, and issues **serial** requests within short counting windows:
one warmup and five measured requests per route. This is an additional
measurement, not a production endpoint or middleware.

With a dedicated PostgreSQL database ending in `_test` and Redis configured as
in [API testing](testing.md), run from the monorepo root:

```sh
API_PERF_SQL_REPORT=1 pnpm --filter @gym/api exec vitest run --config vitest.config.e2e.ts test/e2e/infra/performance-query-count.e2e-spec.ts
```

The opt-in `API_PERF_SQL_REPORT` log contains only route **keys** and numeric
min/p50/p95/max SQL query counts. It excludes SQL text, parameter values,
response payloads, tokens and account identities. The suite uses a separate
PrismaClient with `query` **event emission enabled only in this E2E process**;
production `PrismaService` and Prometheus telemetry remain unchanged. The
database-name guard refuses non-test databases before any connection. The
HTTP throughput, caching, query optimization and response contracts are not
modified.

Counts represent all Prisma SQL events in each **sequential in-process request
window**, including session/auth queries. They can also include unrelated
scheduled DB work, so isolate the test runner and compare only runs with the
same seeded dataset, roles, fixture shape and configuration. A minimal pair
of accounts and an empty workout/program dataset cannot stand in for a
realistic populated load fixture. The HTTP benchmark's latency sample count
and the SQL probe's query sample count are deliberately different; **do not
combine their percentiles into one per-request measurement**.

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

## Compare before/after captures

Use the [API performance comparison guide](performance-comparison.md) and
`pnpm perf:api:compare` to validate independent before/after capture bundles
before interpreting latency, Prisma query counts or SQL plans. Different
HTTP, query-count and EXPLAIN fixture populations are compared **only within
their own source**, not combined into a single traced request.

## Remaining acceptance criteria

Issue #313 remains open for actual **before/after** SQL and HTTP measurements
under identically populated, realistic test fixtures, with explain-plan reviews
and a documented comparison before any query/index/cache optimizations.
Do not enable SQL query logging on production or include bound PII values in
reports. Do not add speculative indexes or caching based on exploratory numbers.

The API's existing `/internal/metrics` histograms are service-wide and
unlabeled (intentional privacy/cardinality design); they must not be
misrepresented as these per-route timings.
