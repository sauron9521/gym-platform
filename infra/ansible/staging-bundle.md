# INF09a — staging host configuration assembly

The first signed pilot has passed its source CI, publication and disposable
rehearsal. Reuse the existing inactive OpenTofu roots and pinned Ansible
controller. This role stages reviewed configuration candidates, not live
configuration. It does not install packages, enable services, change firewall
rules, connect over SSH or provision infrastructure.

## Candidate contract

The `staging_bundle` role requires the local staging fixture and its exact
environment marker from `host_layout`. It copies the existing SSH candidate,
local-CA Caddyfile, staging environment example, Docker daemon candidate and
[systemd edge unit](../services/README.md) without maintaining duplicate
templates. Files are private (0600); the containing directory is 0700. The
bootstrap plan records the intended Ubuntu 24.04 AMD64 host, named operator,
proposed packages and required private inputs by name, never their values.
The Docker and Caddy packages are candidates. The [package bootstrap rehearsal](../bootstrap/README.md)
validates signed repository setup and selected vendor versions; the upgrade
policy, systemd activation and real ownership remain separate work. Docker
group membership is not granted.

Run the existing validation entry point:

```sh
bash infra/ansible/verify.sh
```

Its network-isolated nonroot container checks the original layout, assembles
the staging candidates, rejects production and mismatched environment markers,
checks idempotence, detects simulated content and mode drift in check mode
without modifying the files, then repairs the drift and verifies exact source
bytes and modes. Both real inventories remain empty. The fixture is not a
remote bootstrap playbook and cannot establish real Ubuntu ownership, SSH,
firewall enforcement, package installation or systemd behavior.

## Remaining staged work

- INF09a: further prepare reviewed host/service configuration and state/input
  contracts; retain inactive roots and empty live inventories.
- INF09b: immutable digest-only deployment automation, migration and rollback
  gates, private inputs and service checks.
- INF09c: clean local Ubuntu VM rehearsal, including installation, actual
  ownership, access recovery, service activation and repeat deployment.
- INF09d: separately approved staging-only VPS, current gross-cost review,
  private state and access setup, reviewed plan/apply.
- INF09e: external staging acceptance, actual HTTPS and critical authenticated
  journeys, recovery and operational evidence.

The existing monthly ceiling is EUR 50. No procurement, real provisioning,
DNS mutation or external staging is authorized by this slice. Production and
Beta remain NO_GO.
