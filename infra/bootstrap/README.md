# INF09a.2 — Ubuntu package bootstrap rehearsal

This is a disposable package-installation experiment, not a deployable host
image or a live bootstrap playbook. It extends the
[staging preparation sequence](../ansible/staging-bundle.md) without
activating either cloud inventory.

## Package source policy

The digest-pinned Ubuntu 24.04 AMD64 base is checked by actual OS identity
and architecture. Ubuntu supplies OpenSSH, CA certificates and the initial
curl/GPG tooling. Docker and Caddy use separate signed APT sources with
dedicated keyrings, exact primary key fingerprints and origin-specific
package allowlists. An APT update failure or unexpected key must stop the
build. No convenience installer, unsigned package source or apt-key is used.

References: [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/),
[Caddy installation](https://caddyserver.com/docs/install),
[Caddy repository public keys](https://cloudsmith.io/~caddy/repos/stable/pub-keys/).

The six vendor package versions in `vendor-packages.lock` are exact tested
candidate versions, not an assertion of vulnerability-free software.
Ubuntu packages and transitive dependencies resolve from signed current
repositories; this is not a full immutable APT snapshot. Review all package
versions, security advisories, repository availability and the upgrade
policy before approving real host activation. A missing pinned version
requires review, not a silent substitution.

## Local verification

From the repository root:

```sh
bash infra/bootstrap/verify.sh
```

Only the named public configuration files are copied to a temporary Docker
build context. The build may access public package repositories, not
private credentials. Package maintainer scripts run in the disposable
build with service startup denied by policy-rc.d. Generated SSH host keys
are removed in the same build layer. Repeat APT installation is simulated
and must report zero package changes. The final verification runs nonroot,
network-isolated, read-only and capability-dropped, without a Docker socket,
and checks the installed vendor versions and executable version commands.

The fixture does not prove a running Docker daemon, firewall behavior,
systemd startup, rootless Docker, SSH login or real Caddy TLS. Package
installation may create unit files and enablement links inside the test
image; no service activation on a VM or host occurs. The initial Ubuntu
package installation reported four packages not upgraded; a complete
security patch and upgrade policy is still required for INF09c.
No live package manager is invoked.

The [service contract rehearsal](../services/README.md) uses a separate
build target with systemd and jq for offline validation. The default
package-only target remains unchanged in scope. An actual clean Ubuntu VM
is required before approving a VPS.
No cloud provisioning, DNS, SSH changes, secret creation or production
deployment is authorized. Production and Beta remain NO_GO.
