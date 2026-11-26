# Security stabilization — regression evidence review

**Scope:** selected source and automated regression checks, based on main
`0f528cd` (2026-11-26) plus this change. This is not an independent
penetration test, complete endpoint audit, production approval or Beta GO.

## Coverage and ownership

| Area             | Evidence                                                                                                                                                                       | Remaining boundary                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Account deletion | #953, #956: persisted MFA gate and distributed account quota                                                                                                                   | #948: enrolled-account fresh proof and security review; no execution                                                  |
| MFA lifecycle    | #958: concurrent TOTP replay and transaction rollback                                                                                                                          | #290: public challenge/enrollment, fresh step-up for sensitive writes, recovery and multi-replica/device verification |
| Admin sessions   | `admin-users.e2e-spec.ts`: realm mismatch, different-account cookies, scoped logout, expiry, origin, bearer rejection                                                          | #289: deployed browser/proxy isolation and lifecycle                                                                  |
| RBAC             | `admin-users.e2e-spec.ts`: live allowlist removal and malformed configuration; permission registry and guard unit tests                                                        | #288: complete endpoint matrix and release-specific authorization review                                              |
| Object ownership | `body-measurements.e2e-spec.ts`: cookie and bearer access, foreign/missing identifiers, no unauthorized mutations; existing workout, exercise, program and relationship suites | #288/#291/#361: full cross-role, endpoint and object coverage on release candidate                                    |
| Mobile           | `mobile-token-session.test.mjs`: delayed refresh from prior account, persistence-before-access; encrypted draft and foreground tests                                           | #324/#345: actual signed Android/iOS storage, restart, logout and account-switch evidence                             |

The added checks use the real API composition with disposable PostgreSQL,
except that the existing outer HTTP throttler override isolates authorization.
The distributed quota regression uses Redis. Mobile contract tests exercise the
token-session logic; the encrypted-draft tests mock native modules. Neither
proves native Keychain, Keystore or SQLCipher behavior on a device.

## Observed cross-realm behavior

An Admin session token presented under the ordinary cookie name is denied.
The current authentication library discards a session if the ordinary
provider rejects its principal, so this also removes that presented Admin
session. A token presented under the wrong cookie name must never grant
access; this observed revocation is not evidence of privilege escalation.
The mixed-account cookie and scoped logout checks use a separate valid
Admin session and assert ordinary identity/session isolation. Retain #289
for review of realm-scoped revocation semantics and actual browser behavior.

## Release decision

The [permission matrix](../api/permission-matrix.md) remains the
source-backed authorization inventory. The [Beta gates](../beta-readiness-gates.md)
remain PRE-BETA NO_GO: S1, S2, S3 and device/operations gates are not signed off.
Do not enable deletion execution, mandatory MFA, public challenge endpoints
or unreviewed privileged writes based on this regression suite.

Before release, record the exact candidate, CI and staging artifacts, signed
native builds, dependency/security scan and workflow/secret review, residual
risks and independent security signoff. Keep the existing owning issues open
until their acceptance criteria are verified; no new duplicate issue is
required by this test-focused change.
