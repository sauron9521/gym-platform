# INF02 — inactive OpenTofu foundation

This candidate implementation is deliberately inert. It does not create
infrastructure or authorize any purchase, cloud API request, live plan,
apply, destroy, state migration or DNS change. See the
[owner-approved INF01 decision](../../docs/operations/infrastructure-hosting-decision.md).
Production and Beta remain NO_GO.

## Layout and version contract

- `staging/` and `production/`: independent root directories, each with
  its own provider lock and proposed configuration. Both hard-code
  `count = 0` for the cloud module and have no SSH key IDs.
- `modules/vps/`: reusable candidate Hetzner VPS and firewall schema;
  directly tested using OpenTofu's mock provider, not a real plan.
- `verify.sh`: disposable validation runner, no credentials or state
  transferred from the checkout.

OpenTofu 1.12.12 uses a pinned official container digest; the
Hetzner Cloud provider is locked to 1.70.2 with registry checksums.
The versions are selected reproducibility pins, not a claim that they
are the newest or vulnerability-free. Review upgrades separately.

Staging CX33 and production CX43 are candidate AMD64 SKUs, Nuremberg
(`nbg1`) is a proposed German location, and Ubuntu 24.04 is a candidate
image. Mock tests also cover Falkenstein (`fsn1`). Confirm availability,
architecture and gross pricing before a live plan. The EUR 50 output is
the shared total monthly ceiling, not an allowance per environment.
No provider pricing or availability is verified by mocks.

The module attaches an ingress-deny-by-default firewall, enables IPv4
only, provider delete/rebuild protection and OpenTofu prevent_destroy.
An activated server requires existing environment-specific numeric SSH
key IDs and matching environment/SKU. The firewall has no ingress rules,
so activation before INF04 access review could prevent remote access.
No cloud-init, live SSH keys, provider token, public application access,
network or state backend is configured. Provider VPS backups are disabled
in this candidate pending pricing and recovery decisions; never substitute
them for encrypted off-host backups and WAL/PITR.

## Verify with Docker

From the repository root on Linux:

```sh
bash infra/tofu/verify.sh
```

The script copies only configuration, mock tests and provider lockfiles
into a fresh temporary directory. Initial provider download uses the
registry and the checked-in lockfile with backend disabled. Formatting,
schema validation and mock tests run without network access, without
credentials, and without any real plan/apply. Mock tests use
`command = plan` only, not apply. The temporary working directory is
removed at exit. The provider cache is not persisted in the checkout.
The Docker daemon may pull the pinned public image if absent.
The required tooling CI runs this check on full-scope changes.

## Before any real provisioning

1. Confirm the German location, stock, SKU, gross costs, storage and
   backup vendor under the combined EUR 50 budget.
2. Separately review encrypted, access-controlled, locked remote state
   with distinct environment keys and recovery procedures. Local state
   and plan artifacts are ignored, not an acceptable live backend.
3. Use separate Hetzner projects/credentials and isolated environment
   identities; do not reuse production state or tokens in staging.
4. Implement and review INF03–04 bootstrap, SSH recovery, firewall and
   host hardening before enabling the module.
5. Require explicit owner approval for actual plan and apply in separate
   changes. Never remove `count = 0` or protections incidentally.
   No auto-apply workflow is provided.

Mocked validation proves configuration/schema contracts only; it does
not establish provider-side resource availability, external network
isolation, cost, access, security or recovery acceptance.
