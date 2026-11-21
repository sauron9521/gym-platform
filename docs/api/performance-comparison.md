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

## Issue completion

Issue #313 remains open until we capture real before/after results on
controlled populated fixtures, review the plans and the full REST/Prisma
query behavior, and document evidence supporting or rejecting a proposed
optimization. This comparator **does not change production API, schema,
indices, caches or runtime telemetry**.
