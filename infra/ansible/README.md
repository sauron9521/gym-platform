# INF03 — Ansible configuration foundation

This is an inactive, fixture-only foundation for the
[INF01 hosting decision](../../docs/operations/infrastructure-hosting-decision.md)
and [INF02 OpenTofu candidate](../tofu/README.md).
No host provisioning, SSH access, package installation on real hosts,
firewall mutation, service activation or deployment is authorized.

## Layout

- `inventories/staging/hosts.yml` and `inventories/production/hosts.yml`:
  distinct named groups and environment identities, deliberately empty.
- `ansible.cfg`: host-key verification enabled, no retry files, local role
  path, staging inventory default (no hosts).
- `roles/host_layout/`: first idempotent role, deliberately restricted to
  the synthetic local fixture. Tests model directory layout and permissions,
  not actual owner/group policy or real host bootstrap.
- `playbooks/fixture.yml`, `tests/`: two local fixture identities, positive,
  negative, repeat and check-mode acceptance.
- `Dockerfile`, `requirements.lock`, `verify.sh`: reproducible Linux AMD64
  validation controller, not an image to deploy on a VPS.

The controller pins the official Python 3.12 slim Bookworm image digest,
Ansible Core 2.20.11 and all nine resolved wheel versions/hashes (including
Ansible itself). Installation requires exact hashes and binary wheels;
`pip check` verifies dependency consistency. No Ansible Galaxy collection
or external role is necessary. These are tested compatibility pins, not
a statement that they are the newest or vulnerability-free versions.

## Local acceptance

From the repository root on Linux with Docker:

```sh
bash infra/ansible/verify.sh
```

The script copies only the named configuration and locked dependencies to
a temporary build/fixture context. The image build may reach the public
Python package registry; the test container is nonroot, read-only,
capability-dropped, without networking, Docker socket, SSH agent, keys
or other host credentials. Its only writable filesystem is temporary.
No SSH or real host operation occurs. A fresh run uses two synthetic
identities inside `/tmp/ovranto-ansible-fixture`; the fixture disappears
when the container exits.

The role validates the fixture identity before changes, creates distinct
environment roots, proposed app/config/data/media paths with restricted
modes and an environment marker containing no secrets. A first run must
change the directory and marker tasks for both fixtures; the second run
and subsequent check mode must report no changes. A mismatched environment
must fail before file operations. The final test independently reads
actual modes and marker contents. Both real inventories must contain zero
hosts. Required tooling CI runs this verification on full-scope changes.

The proposed paths are `/opt/ovranto`, `/etc/ovranto` and
`/var/lib/ovranto` (including private media), **under the synthetic
prefix only**. These do not override current runtime volume or restore
contracts. Actual ownership, service accounts, disk layout, permissions,
systemd and package installation need INF04–05 review.

## Activation boundary

INF04 must design reviewed SSH recovery, host-key verification,
least-privilege operator accounts, access allowlists, firewall and
Ubuntu compatibility. Future live inventory/roles need an explicit
owner-approved activation change and verified target identities.
Never copy production inventory, secrets or host keys into staging.
Store live inventory and secret references privately. Gitignore rules
are supplementary safeguards, not a secret management system.

No actual Ubuntu host, systemd, SSH connectivity or cloud firewall has
been tested here; the fixture is Debian-based Python in Docker.
Production and Beta remain NO_GO. Do not remove the OpenTofu activation
guard or add a remote apply workflow as part of this slice.
