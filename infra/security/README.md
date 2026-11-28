# INF04 — Host access and security candidate

Authority: [INF01 decision](../../docs/operations/infrastructure-hosting-decision.md),
[OpenTofu](../tofu/README.md), [Ansible](../ansible/README.md),
[S05](../../docs/product-strategy/s05-security-trust-v1.md) and
[S06](../../docs/product-strategy/s06-production-reliability-v1.md).

This is an inactive, reviewable access policy, not a live host bootstrap.
No servers, real keys, cloud credentials, DNS, accounts or firewall
changes are authorized. Both OpenTofu roots remain at count zero and
both real Ansible inventories remain empty.

## Candidate access policy

| Boundary                   | Proposed control                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Cloud ingress              | Default deny; optional explicit operator IPv4 /32s only on TCP 22                        |
| Public application ingress | None in INF04; review HTTP(S) and Cloudflare origin trust in INF05                       |
| SSH authentication         | Public key only; no password, keyboard-interactive or root login                         |
| SSH identity               | Named ovranto-operator account; host-key verification, no shared production/staging keys |
| SSH features               | No forwarding, tunnels, X11 or user environment; internal SFTP for future configuration  |
| SSH limits                 | Three auth attempts, 30-second login grace, four sessions; verbose auth logging          |
| Privilege                  | No blanket passwordless sudo, Docker group or unrestricted remote root execution         |
| Local secrets              | Restrict access, never store private keys, real IP allowlists or tokens in Git           |

The reusable VPS module accepts at most eight explicit IPv4 /32 addresses,
defaults to an empty set, and emits only one inbound TCP/22 rule if supplied.
Mocks use reserved documentation addresses only; no actual operator address
has been chosen. A /32 is a deliberately conservative candidate policy,
not a promise that the operator has a stable public IP. If a mobile or
dynamic address makes it impractical, evaluate a private administrative
VPN separately. Do not use a world-open SSH rule as a fallback.
No provider-side firewall or host packet filtering has been exercised.

The standalone `sshd_config.candidate` is not an installed drop-in.
Ubuntu may have cloud-init includes, earlier matching settings, socket
activation, distro-specific defaults and PAM policies. Test the effective
installed policy and actual login before disabling the bootstrap path.
SSH server host keys must be generated on the intended host and verified
through a trusted provider console, not accepted blindly. Public SSH keys
may be enrolled only after environment and owner confirmation; real
private keys never belong in the repo or CI.

## Local validation

Run from the repository root:

```sh
bash infra/security/verify.sh
bash infra/tofu/verify.sh
```

The first command uses a digest-pinned Ubuntu 24.04 validation image and
installs OpenSSH from the supported Ubuntu package repositories in an
isolated build. Apt patch versions are intentionally not a frozen snapshot;
the test reports the resolved OpenSSH package version. Service activation
is denied at build time; generated build host keys are removed in the same
layer. The runtime container has no network, read-only root filesystem,
dropped capabilities and temporary /run and /tmp. It generates a synthetic
temporary key, runs actual `sshd -t` and `sshd -T`, and verifies the
effective candidate settings. It never starts a listener or attempts login.
The test is not a host hardening or PAM authentication proof.

OpenTofu tests check default-deny and exact synthetic allowlist behavior,
reject broad IPv4 ranges, IPv6 and malformed addresses, and retain the
inert roots. Required tooling CI runs both validators on full-scope changes.

## Before enabling live SSH

1. Owner approves staging-only provisioning, budget, state backend and
   exact access source addresses. Establish Hetzner account MFA and
   verify access to the provider console and recovery mechanism first.
2. Inspect the target host identity, image and network boundary out of
   band. Enroll environment-specific public keys and create a named
   operator account with restricted privileges; validate its home,
   authorized_keys ownership and modes. Record no secrets in Git.
3. Keep an authenticated existing bootstrap session and trusted recovery
   console available. Verify the new named-account key login in a
   second independent session and test the required privilege elevation.
4. Review the effective SSH settings for the actual operator and root
   contexts, including cloud-init, systemd/socket activation and PAM.
   Validate syntax, then change one access layer at a time. Prove allowed
   login and denial of root/password/unapproved source from separate
   test clients before closing the bootstrap session.
5. Verify host firewall and Docker networking together; Docker-published
   ports can bypass naive host-filter assumptions. Keep database, Redis,
   metrics and Docker socket private. No public HTTP(S) until INF05 review.
6. If new access fails, stop rollout. Use the still-open session or
   authenticated provider console to restore the last known-good
   configuration and firewall allowlist. If recovery cannot be verified,
   do not proceed to staging deployment.

Actual account creation, sudo policy, host firewall enforcement,
patching, audit retention, access recovery and Ubuntu service behavior
require a later explicit owner-approved implementation and host
acceptance. Do not claim this syntax test proves live security.
Production and Beta remain NO_GO.
