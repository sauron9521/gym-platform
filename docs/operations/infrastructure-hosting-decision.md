# INF01 — Hosting decision and infrastructure budget

**Status:** owner approved on 2026-11-28; repository record pending manual
merge. This is an infrastructure planning decision, not permission to
purchase resources, change DNS, deploy applications or invite Beta users.

Source baseline: [61f4c1e](https://github.com/sauron9521/gym-platform/commit/61f4c1e3539824e95252955125036b497afce1c4).
Authority: [S06](../product-strategy/s06-production-reliability-v1.md),
[deployment plan](full-stack-deployment-plan.md),
[DEP11 review](full-stack-deployment-readiness-2026-11-28.md).
Existing ownership: #393, #351, #352, #921, #922 and #923.

## 1. Explicit owner decision

The owner approved INF01 with the following four values:

| Decision                      | Approved value |
| ----------------------------- | -------------- |
| Provider                      | Hetzner Cloud  |
| Region                        | Germany (DE)   |
| PostgreSQL                    | Self-hosted    |
| Monthly infrastructure budget | EUR 50 maximum |

The owner explicitly requested documentation and the next PR **without
ordering servers**. Neither a specific data center nor a server SKU,
operating system, backup vendor, tool version or paid service was
individually approved by that message. The technical proposal below
remains subject to review. Record further decisions separately.

Self-hosted PostgreSQL is conditional on S06 recovery acceptance:
encrypted off-host backups, WAL/PITR or a proven equivalent, recovery
of private media and actual restore evidence. A budget ceiling does
not waive these requirements. Retain NO_GO if the requirements cannot
be met within the budget; do not silently exceed the ceiling.

## 2. Proposed environment topology

| Environment | Candidate              | Resources                      | Scope                       |
| ----------- | ---------------------- | ------------------------------ | --------------------------- |
| Development | Existing local machine | Existing resources             | Development only            |
| Staging     | Hetzner CX33, x86-64   | 4 vCPU, 8 GB RAM, 80 GB disk   | Isolated test deployment    |
| Production  | Hetzner CX43, x86-64   | 8 vCPU, 16 GB RAM, 160 GB disk | Future controlled free Beta |

The server models and sizes are candidate configurations from the
planning discussion, not verified availability or procurement approval.
Confirm the actual SKU, architecture, included traffic, disk, region,
stock and final gross price in the provider console before ordering.
Select a German location only after availability and latency review.

Prefer staging first, then production only after staging acceptance and
separate owner authorization. Keep both environments independently
recoverable: separate cloud project or equivalent isolated access,
network, VPS, database, Redis, private media, SMTP allowlist, JWT
issuer/secrets and deployment identities. Never use production data
or secrets in staging. Keep one API replica per environment.

Each VPS runs the existing AMD64 containerized modular monolith, four
Next.js applications, self-hosted PostgreSQL 17 and Redis 8. Caddy and
Cloudflare remain the proposed edge/DNS configuration; only approved
HTTP(S) endpoints may be public. PostgreSQL, Redis, internal metrics
and Docker socket must not be exposed. Verify host and proxy trust,
TLS origin and renewal, firewall and SSH rules before external access.
Do not publish staging URLs until the owner approves their names and
access controls.

Candidate OS: Ubuntu 24.04 LTS. Validate pinned base-image and host
package compatibility. No Kubernetes, additional worker, paid
feature or horizontal scale-up in the initial topology.

## 3. Recurring cost controls

The EUR 50 cap is approved; the following allocation is a conservative
planning proposal, not a provider quote or authorization to spend.
Treat the ceiling as total recurring gross infrastructure cost until
the owner explicitly clarifies a different tax/cost treatment.

| Cost item                                              | Indicative EUR/month |
| ------------------------------------------------------ | -------------------: |
| Production candidate with IPv4                         |                16.49 |
| Staging candidate with IPv4                            |                 8.99 |
| Optional provider server backups                       |                 4.90 |
| Independent off-host backup storage allowance          |                10.00 |
| Independent monitoring allowance                       |                 5.00 |
| Subtotal before taxes and unpriced charges             |                45.38 |
| Unallocated headroom before taxes and unpriced charges |                 4.62 |

These numbers are inherited planning assumptions, not newly verified
live tariffs. The subtotal is not a guaranteed gross bill. Confirm
taxes, exchange/payment fees, network traffic, storage requests and
egress, monitoring/alert delivery, SMTP, snapshots and any other
recurring services before deciding whether the cap is feasible.
Account for domain renewal if charged to the infrastructure budget;
existing hardware and development time are not cloud recurring charges.

If the full configuration exceeds EUR 50, present alternatives
(including staging-only initially) and request approval. Do not cut
mandatory backup, restore, monitoring or isolation controls to fit
the cap. Provider VPS backups are supplemental, not a substitute
for off-host application-consistent backup and proven PITR.
Set a budget alert if supported; an alert is not a hard spending limit.

## 4. Proposed implementation toolchain

| Concern                | Candidate                                                               |
| ---------------------- | ----------------------------------------------------------------------- |
| Cloud provisioning     | OpenTofu and Hetzner provider                                           |
| Host configuration     | Ansible                                                                 |
| Runtime                | Docker Engine and Compose; existing immutable GHCR images               |
| Edge                   | Caddy and Cloudflare                                                    |
| Database recovery      | pgBackRest with encrypted off-host repository and WAL archive           |
| Private media recovery | Restic with separately protected repository                             |
| Observability          | Existing Prometheus, Grafana, Blackbox Exporter; Alertmanager candidate |

These tools are proposed, not deployed. Before adoption, verify current
upstream compatibility, licenses, versions, security and maintenance.
Reuse existing release, restore and monitoring contracts. The existing
backup scripts remain available until a replacement passes equivalent
or stronger acceptance. No credential values, real infrastructure
state, private key, plan artifact with secrets or user data in Git.

## 5. Infrastructure delivery sequence

One reviewable PR per task, latest main, relevant green CI, manual
owner merge. Reuse existing issues and milestones; no new competing
epic or duplicate task. INF01 records the decision only.

| Slice | Scope                   | Acceptance boundary                                                                                   |
| ----- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| INF01 | Hosting decision        | Approved four values recorded; no provisioning                                                        |
| INF02 | OpenTofu foundation     | Versioned, isolated staging/production roots, typed inputs and plan-only offline validation; no apply |
| INF03 | Ansible foundation      | Reproducible inventory and idempotent host configuration, local validation                            |
| INF04 | Host security           | SSH, firewall, least privilege, access recovery and operator review                                   |
| INF05 | Runtime and edge        | Docker, Caddy, Cloudflare origin/TLS/DNS plan; no automatic live changes                              |
| INF06 | Stateful dependencies   | PostgreSQL, Redis, encrypted off-host backup, WAL/PITR and restore                                    |
| INF07 | Observability           | Metrics and independent delivered alert verification                                                  |
| INF08 | Immutable pilot release | Existing six-image signed GHCR chain and exact green source CI                                        |
| INF09 | Real isolated staging   | Explicit owner permission, reviewed cost, actual HTTPS and critical read/write journeys               |
| INF10 | Production preparation  | Recovery, rollback, operational and Beta evidence; separate owner GO                                  |

INF02 must not request or require live cloud credentials for its
offline checks. Use separate state boundaries, a documented future
encrypted/locked state backend, provider/version lock file and
synthetic validation. No auto-apply workflow, purchase, destroy,
DNS mutation, firewall changes or secret creation. Real plan and
apply require a later, explicit operator decision and actual cost
review. Do not treat a configuration merge as an apply authorization.

## 6. Remaining acceptance

The approved recovery objectives remain Beta RPO at most one hour and
RTO at most four hours; verify application consistency and actual
post-restore critical journeys. Demonstrate two independent delivered
P0/P1 alert paths, exact signed release identity, compatible rollback,
staging isolation and security/native/legal acceptance under the
existing [Beta evidence gates](../beta-readiness-gates.md).

**Current disposition:** INF01 approved, infrastructure provisioning
not authorized, deployment NO_GO, Beta NO_GO. The next implementation
slice is INF02, after this record is merged.
