# INF09a.3 — inactive staging system service contracts

Reuse the Ubuntu package rehearsal and canonical staging Caddyfile. This
slice prepares a Docker daemon logging candidate and a standalone staging
edge unit. Neither is installed on the development host or enabled remotely.
Both are staged as private candidate files by the Ansible fixture.

## Candidate contracts

- `docker-daemon.candidate.json`: local Docker logging driver, bounded
  per-container log rotation (10 MB, three files), info daemon verbosity.
  This is not a host-wide disk quota; existing Compose service-specific
  logging limits remain authoritative. No TCP Docker API or extra daemon
  listener is introduced. Preserve the vendor Docker/containerd units.
- `ovranto-staging-edge.service`: explicitly started candidate using the
  package-created caddy account, only CAP_NET_BIND_SERVICE, private
  persistent CA state, strict filesystem protections, bounded restart and
  timeout policy. The unit requires an already running Docker service
  (Requisite plus After) and approval/config files; it does not start the
  stack or perform migrations. No Install or ExecReload section.
- The canonical staging Caddyfile binds only IPv4 loopback on ports 80/443;
  the existing direct-peer ACL, disabled admin API and local CA remain.
  The unit also requests systemd loopback-only IP filtering, whose actual
  cgroup/BPF enforcement needs VM acceptance.

## Activation order (future, separately authorized)

1. Confirm host identity, patch policy, recovery access and private inputs.
   Validate and review effective Docker config together with vendor flags
   before applying it. Do not replace an existing daemon config blindly.
2. Ensure Docker/containerd are healthy. The future deployment mechanism
   verifies signed digests, starts stateful dependencies, checks readiness,
   performs reviewed forward migrations and checks the application services.
   Docker daemon readiness alone does not establish application readiness.
3. Keep the package default Caddy service inactive; verify no conflicting
   listeners. Stage a root-owned readable Caddyfile and approval marker
   under /etc/ovranto/staging. Establish caddy state ownership and verify
   local CA handling. The marker alone is not deployment authorization.
4. Explicitly start the candidate edge only after health acceptance.
   No automatic migration on restart or boot. Since the admin API is
   disabled, configuration changes require a reviewed restart, not reload.
5. Verify private HTTPS, listener scope, restart limits, failure recovery,
   service ordering and boot policy in the local Ubuntu VM. Stop edge before
   incompatible state changes. External ingress needs separate approval.

## Offline verification

```sh
bash infra/services/verify.sh
node scripts/reverse-proxy-smoke.mjs --staging
```

The first command builds the separate validation target from the same
Ubuntu package fixture; systemd and jq come from signed Ubuntu repositories.
The final nonroot, read-only, network-isolated container checks real
systemd-analyze, dockerd --validate, Caddy validation and adapted listener
addresses; malformed Docker options and nonexistent unit executables must
fail. It does not run systemd as PID 1 or start a daemon. The second command
runs the existing isolated synthetic edge regression. Full-scope CI runs
the service validator and the existing proxy checks.

Not proven: actual systemd activation, dependency failure behavior,
filesystem/cgroup isolation, daemon configuration merge, real ownership,
reboot or public HTTPS. The separate package candidate remains inactive.
No secrets, approval marker, remote changes, provisioning or service
enablement are included. Production and Beta remain NO_GO.
