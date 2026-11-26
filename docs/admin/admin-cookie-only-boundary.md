# Admin API cookie-only authentication boundary (#289)

**Status: dedicated Admin cookie realm, bounded lifetime and scoped revocation implemented. Staging lifecycle verification and step-up remain separate gates.**

The existing privileged routes require an authenticated, persisted, admin-purpose server-side cookie session via `@Authenticate({ providers: [AdminSessionCookieProvider] })`:

- `GET /admin/users` and `GET /admin/users/:userId`
- `GET /admin/trainer-applications`
- `POST /admin/trainer-applications/:id/approve`, `reject`, `revoke`

A valid JWT bearer token (even one issued to an allowlisted operator) **never
substitutes** for the cookie. When a cookie and conflicting bearer token are
both supplied, authorization uses the cookie principal alone. Existing
permission policies re-read the persisted operator role and allowlist.
Expired, suspended or revoked cookies are rejected by the existing SessionStore.
Authentication failures must not return personal records, and responses remain
`Cache-Control: no-store`.

**Compatibility:** `/auth/token` and normal Athlete/Trainer/API bearer routes
are unchanged. The privileged endpoints intentionally cease to support
bearer-only clients. Swagger declares cookie authentication for them. The
Admin Web login now requires a fresh admin-purpose cookie instead of reusing
ordinary application login state. Existing Admin browsers must sign in again
after deployment. The cookie is still server-issued and HttpOnly.

**Admin-purpose login:** A normal `/auth/login` cookie no longer authorizes Admin
routes. `POST /auth/admin-login` requires fresh password verification and
a currently persisted ADMIN role, and issues a session containing a server-only
`metadata.purpose = "admin"` marker. `GET /auth/admin-session` verifies it
using cookie-only authentication and replies with only `id` and `role`. The
Admin Web checks this endpoint for every protected page request.

**Admin session expiry:** Admin-purpose sessions have an **8-hour absolute**
expiry (stored in PostgreSQL and issued as the cookie Max-Age) and a
**15-minute idle timeout**. The store validates both limits against persisted
timestamps **before** the shared session service updates activity. The same
server-side rule applies to older admin-purpose cookies. Normal Athlete/Trainer
sessions retain the shared 7-day/1-day limits.

**Scoped Admin revocation:** `POST /auth/admin-sessions/revoke-all` requires a
live admin-purpose cookie (never a bearer JWT or an ordinary ADMIN session).
It atomically deletes **only the caller's** `metadata.purpose = "admin"`
sessions using a PostgreSQL user-row lock consistent with session issuance,
and clears the caller's cookie. Ordinary sessions, other users' Admin sessions
and refresh-token families are preserved. The endpoint is idempotent for
multiple live admin browsers, but a revoked browser cannot call it again:
subsequent requests return 401. It is intentionally different from the
existing `/auth/sign-out-everywhere`, which revokes every session and refresh
token family for the user.

**Historical intermediate state:** Admin-purpose sessions initially shared the ordinary cookie name and session table. The separate cookie realm and origin hardening described below supersede that intermediate state. Staging lifecycle verification remains necessary. Complete #290 for
recent proof of password/MFA, step-up expiry and safe recovery before enabling
account suspension/reactivation or role/price privilege changes. The current
trainer-review write endpoints already exist but remain without step-up, which
must be addressed as part of the future sensitive-mutation hardening.

That earlier slice introduced no Prisma migration or separate cookie realm; the later
Admin-cookie realm cutover is documented below.

## Admin-only Origin boundary (#289)

The explicit Admin login, live Admin session check, scoped Admin revocation,
privileged Admin users reads and trainer moderation operations now require an
exact **Admin browser origin** when the request provides `Origin`: the
validated `ADMIN_APP_URL` from API configuration. Where Admin has not yet been
separately deployed, the existing `APP_URL` is the single-web fallback.
A cross-site/same-site browser request without `Origin` is rejected using
`Sec-Fetch-Site`; a provided `Referer` must also match the expected origin.
Contradictory `Origin` and `Referer` are rejected. Originless server-to-server requests remain supported for Next.js SSR.
This narrows browser-origin trust on Admin routes without affecting ordinary
Web/Mobile auth, CORS or session origin configuration. Set `ADMIN_APP_URL` to
the exact public Admin Web origin on deployments with a separate Admin site.
This is defense in depth, not a substitute for the library's CSRF checks,
MFA/step-up, or a dedicated Admin cookie realm.

## Separate Admin-cookie realm (#289)

Admin browser sessions now use an independent, host-prefixed, Secure, HttpOnly
cookie named `__Host-admin-sid` (Path=/, SameSite=Lax). Regular Web
sessions retain `__Host-sid`; both can coexist on the same host and their
session providers do not authenticate on each other's routes. Admin routes
explicitly select the Admin-only provider, which refuses ordinary-route
requests even when an Admin cookie is supplied. Existing Admin sessions
issued under the former `__Host-sid` cookie must sign in again after this
cutover; legacy Admin tokens cannot become ordinary sessions.

The new Admin session service reuses the existing session store and MFA
verifier but has its own 8h absolute and 15m idle limits, cookie issuance,
second-factor rotation and current-cookie sign-out. `POST /auth/admin-sign-out`
clears only `__Host-admin-sid`, including a pending MFA session; the normal
`POST /auth/sign-out` continues to clear only `__Host-sid`. Admin Web uses
the Admin-specific sign-out on denied or pending sign-in.

Independent cookie names do **not** mean separate database or identities:
admin-purpose and ordinary rows still live in the same Session table and
may be revoked globally by account-wide security actions. Dedicated Admin
MFA enrollment, step-up challenges and privileged action re-auth remain
scope of #290. Do not close #289 until operational session lifecycle and
browser/proxy behavior are verified at staging.

### MFA boundary hardening (first #290 slice)

Admin route authorization rejects pending and unknown persisted MFA states,
and binds the server-issued session owner to the authenticated principal.
The internal completion helper accepts one well-formed factor only, on a
POST from the trusted Admin origin. No new public challenge endpoint is
enabled in this slice.

At the first slice, the authentication package had no configured MFA options
or registered durable MFA store. The second slice below adds the adapter;
MFA options remain disabled. A session with no MFA
state remains a transitional legacy session; this is **not** S05 compliance.
Do not enable mandatory enrollment or expose challenge completion before
encrypted durable factor storage, atomic replay/recovery-code consumption
and account-scoped throttling are available and tested. Follow S05: prefer
WebAuthn, support TOTP and one-time recovery codes, and require a fresh
session-bound factor for sensitive actions (maximum five minutes).
Recovery and factor changes must be audited and revoke affected sessions.
Do not close #290 or grant Security/Beta GO based on this hardening alone.

### Durable MFA storage (#290, second slice)

The shared identity now owns three additive PostgreSQL tables:
`mfa_authenticators`, `mfa_recovery_codes` and `mfa_failures`.
The registered adapter implements the existing authentication library's MFA
store contract; it does not issue sessions or invent cryptographic formats.
The library must seal TOTP secrets with AES-256-GCM and hash recovery codes
before calling the adapter. Keys must remain outside PostgreSQL and be
independent of the JWT key. The adapter treats those representations as
opaque values; the live application still has no MFA service configuration.

Replay claims are conditional updates, recovery consumption is a conditional
delete, and replacement batches roll back atomically. Saving an authenticator
cannot lower its claimed TOTP step. Failure accounting locks the active user
row across the insert and count, so concurrent requests cannot all see the
same low count. Old attempts are pruned per user when recording another
attempt; use a consistent configured lockout window. Global retention and
bounded request throttling must be reviewed before any public MFA endpoint.
Physical user deletion cascades factor rows; suspended or soft-deleted
accounts cannot use them.

PostgreSQL contract tests use the package's concurrency suite and verify
encrypted/hashed values with an explicitly configured test-only MFA service.
This is not a live enrollment, recovery or mandatory-MFA rollout. Keep #290
open. Next: protected encryption-key configuration, enrollment and lifecycle
controls, then session-bound step-up and explicit rollout approval.

### MFA encryption keyring preparation (#290, third slice)

The API validates the optional `MFA_ENCRYPTION_KEYS` setting without
activating the MFA service. Keep it unset during this preparatory slice.
The parser accepts one to five distinct, canonical base64url encodings of
32 random bytes, newest writer first. It rejects obvious repeated-byte
material and reuse of the JWT key (including equivalent encoded material).
Shape checks cannot establish entropy: generate independent keys with a
cryptographically secure generator and store them only in the protected
API secret manager. Never put keys in Git, browser/mobile builds, logs,
database rows, or migration containers. The library receives binary keys;
plaintext migration is explicitly disabled.

Future operational rotation, once MFA is activated and lifecycle controls
are in place:

1. Back up the existing keys securely, generate a new key and distribute
   the keyring to all replicas with the old writer first and the new
   reader second. Verify all replicas can read both.
2. Promote the new writer by putting it first, retaining the old reader.
   Confirm fleet convergence before starting any re-encryption.
3. Re-encrypt under the protected factor-lifecycle boundary. The current
   library's re-encryption helper updates the active secret only, not a
   staged replacement secret. Both representations must be inventoried
   before retirement; concurrent enrollment/replacement must be controlled.
4. Retire an old reader only after evidence shows no active or pending
   ciphertext depends on it, and ensure retained backups can still be
   restored using separately protected historical keys.

Tests exercise the actual library cipher and demonstrate that a mixed
writer fleet can reverse rotation. No production key was generated or
installed, no rotation job is exposed, and no live factor was rewritten.
Actual key provisioning, deployment wiring, lifecycle controls and
retirement evidence remain separate gates. Do not activate MFA or close
#290 on the basis of this configuration alone.

### Internal first enrollment staging (#290, fourth slice)

A dedicated internal service stages a first TOTP authenticator only after
fresh password proof for an existing live Admin-purpose session. Account
request throttling permits five attempts per 15 minutes. The final operation
locks the active account and exact session, rechecks role, session expiry
and the credential snapshot, and stages the encrypted secret and its
session binding in one transaction. Enrollment expires within five minutes
and cannot replace a confirmed factor or a live enrollment. Only the caller
receives the plaintext provisioning secret; it must never be logged.

This slice does not expose an HTTP endpoint, confirm factors, generate
recovery codes, or enable MFA in the global authentication module. Keep the
runtime keyring unset until a safe completion and login path is available.
The next slice must bind confirmation to the same live session and expiry,
serialize factor changes, issue recovery codes atomically and invalidate
pre-enrollment credentials before enforcing MFA. No Security/Beta GO.

### Internal first enrollment confirmation (#290, fifth slice)

Confirmation uses the exact live Admin session and its unexpired enrollment
binding. The transaction-bound library verifier claims the TOTP step and
persists failed attempts; a rejected proof returns without rolling back
the attempt counter. A separate account limiter bounds confirmation to
five requests per 15 minutes. Successful confirmation generates ten
one-time recovery codes through the library, persists only their hashes,
clears the enrollment binding, advances the identity JWT revocation fence,
revokes existing sessions and refresh credentials, and writes a minimal
durable lifecycle audit event. All of these writes commit together; no
old session is elevated. Recovery codes are returned once after commit.
A failed response after commit needs a protected recovery/regeneration
path, not automatic replay of confirmation.

This is internal infrastructure, not an activation or public HTTP route.
Account-wide revocation is deliberate because factors belong to the shared
identity. In-flight sign-ins, new credential issuance, ordinary auth
paths and enrolled Admin authorization must be fenced before any public
activation; the global MFA service still has no live configuration.
Audit retention/access, lost-response recovery and key provisioning
remain rollout gates. Do not populate live factors or close #290 yet.

### Confirmed-factor password-only credential fence (#290, sixth slice)

A confirmed factor now blocks password-only session and refresh-token
issuance under the same account row lock used by confirmation. Existing
session and refresh-token reads and refresh consumption also require an
absent or unconfirmed factor. JWT resolution applies that same durable
predicate in addition to the existing revocation fence. These checks
do not depend on the library's disabled MFA configuration.

This is deliberately a fail-closed transitional gate: a confirmed identity
cannot sign in through any existing password-only route, including Admin,
until a dedicated MFA challenge path is implemented. An unconfirmed
enrollment does not block existing authentication. Do not enable live
enrollment or populate confirmed factors yet. The next slice must introduce
a bounded Admin pending-session and verified-session policy, challenge
completion and protected recovery without weakening the shared-identity
fence. Requests authorized before confirmation commits may still complete;
sensitive action reauthorization is a separate gate.

### Internal Admin challenge and atomic rotation (#290, seventh slice)

The internal challenge service requires an active enrolled Admin and fresh
password proof, rechecks the credential snapshot under the owner lock, and
uses an isolated library session service to issue a pending Admin cookie
with a five-minute absolute challenge deadline. Completion binds to the
opaque Admin cookie digest and locks the owner and exact session before
verifying TOTP or a single-use recovery code. Separate account limits
bound password proof and challenge requests. Failed proof commits attempt
accounting; successful proof rotates the session, consumes the factor proof,
and writes a durable minimal audit event in one transaction. The verified
session retains the original password-authentication time and the 8h/15m
Admin lifetime policy. An expired or revoked pending session cannot rotate.

The global password-only fence remains unchanged: both internal pending
and verified sessions are still unusable for public authorization. Neither
the login controller nor the existing cookie helper calls this service.
Before exposure, wire the Admin cookie boundary to a dedicated validated
pending/verified reader, enforce origin checks, handle sign-out and lost
responses, provide protected recovery, verify key provisioning and complete
browser and multi-replica security tests. No live enrollment or production
activation; do not close #290. The audit enum extension is additive.

### Scoped Admin MFA cookie reader (#290, eighth slice)

Challenge-issued sessions carry server-written flow provenance in metadata.
The scoped Admin reader accepts only that provenance, an active ADMIN owner,
a confirmed factor, a configured keyring and a session newer than the
credential invalidation fence. Pending sessions cannot authorize protected
routes or extend their five-minute deadline; verified sessions keep the
8h/15m policy. Legacy password-only Admin sessions remain available only
through the existing fence; an unmarked stored verified state is insufficient.

The internal cookie challenge helper delegates to the atomic coordinator
instead of verifying a factor and rotating separately. Admin sign-out can
discard the exact scoped MFA token, including expired rows, without touching
ordinary credentials. If rotation already won, the old token cannot revoke
the new token; handle lost responses and logout races in the HTTP rollout
gate. Ordinary cookie and JWT stores remain unchanged. No public challenge
or enrolled-user login endpoint is enabled. Existing unmarked internal
challenge rows must be discarded and recreated before exposure. No schema
change, no mandatory MFA activation, and #289/#290 remain open.

### Recovery-code regeneration (#290, ninth slice)

The internal self-service operation requires a live scoped verified Admin
cookie, fresh password proof and a newly verified TOTP. A recovery code,
password alone or an old step-up cannot regenerate the batch. The
account-scoped limiter and library replay/attempt controls are retained.
Under the owner and exact session locks, replacement hashes, credential
invalidation, all identity sessions, refresh-family revocation and durable
audit commit together. The original factor is retained. Plaintext codes
return once after commit; all devices must reauthenticate. A failed proof
commits failure accounting without changing codes.

The operation has no HTTP route. A separate lost-factor recovery procedure,
recovery-code sign-in containment, security notices, safe lost-response
handling and device/browser validation remain rollout gates. Never enable
mandatory MFA or close #290 on the basis of this internal slice.

### Admin MFA assurance context (#290, tenth slice)

The transaction-bound issuer records the verified method as server-owned
session metadata: TOTP or recovery code. Pending sessions carry no
verified method; the scoped reader rejects inconsistent, missing or
unknown assurance on verified sessions. Inherited metadata cannot select
a proof method. Existing unmarked verified internal sessions must be
discarded and recreated; no backfill can prove how they authenticated.
WebAuthn is not an accepted method until a verified implementation exists.

This slice records assurance, not recovery containment. Recovery sessions
still follow the previous authorization policy; no public login or MFA
challenge is exposed. The following slice must restrict recovery-issued
sessions, check assurance at sensitive operations including regeneration,
revoke prior credentials on recovery sign-in and test the restricted
boundary before any HTTP rollout. No migration or new dependency.

### Recovery sign-in containment (#290, eleventh slice)

A successful recovery-code challenge rotates to a restricted grant and
revokes all other identity sessions and refresh credentials in the same
transaction as code consumption and the existing durable challenge audit.
The grant is tied to the exact new account invalidation fence, not to a
general exception for previously revoked credentials. It expires ten
minutes after initial password authentication and cannot slide. All
existing Admin routes, ordinary cookie/JWT routes and recovery-code
regeneration deny recovery assurance. Sign-out remains available. No
public recovery-specific endpoint exists yet; the grant is internal-only
until a separately reviewed factor-replacement flow is ready.

The earlier verified recovery sessions without the new fence marker are
invalid. No new migration or dependency. A later factor change must
revoke the grant and require fresh normal authentication. Notifications,
lost-response handling, browser/device verification and mandatory MFA
remain gated. #289/#290 stay open.

### Recovery-bound TOTP replacement (#290, twelfth slice)

An internal restricted recovery grant plus fresh password verification
can stage a library-generated encrypted replacement candidate. The old
confirmed factor remains active until successful confirmation. Binding
reuses the existing enrollment session/deadline fields, with a maximum
five-minute candidate lifetime and the earlier recovery-grant deadline.
Live candidates cannot be overwritten; expired candidates or candidates
bound to a revoked grant may be replaced. Unbound candidates fail closed.
The library's per-identity replay counter is retained across replacement.

Confirmation requires the exact current recovery grant, fresh password
and a new-factor TOTP. The owner and session locks serialize the flow.
Activation, new recovery-code hashes, revocation of all identity
credentials, binding removal and durable audit commit together. Failed
proofs persist attempt counts, and failed writes roll back factor changes.
The restricted grant cannot upgrade to a normal Admin session; fresh login
is required. No public API, UI or production activation.

Remaining gates: recovery policy/owner approval (password plus one-time
recovery proof authorizes replacement), abandonment cleanup for staged
candidates (including blocked regeneration), security notifications,
lost response, browser/device and multi-replica tests. The original TOTP
may still be used for a fresh login before replacement confirmation;
containment of a known compromised old factor needs a separate policy.
#289/#290 stay open. Audit enum migration is additive.

### Transactional MFA security notices (#290, thirteenth slice)

The accepted ADR-008 / #568 OutboxEvent contract gains its initial
producer-side persistence. First TOTP confirmation, recovery-code
sign-in, code regeneration and replacement staging/confirmation record
an account.security.changed v1 event in the same transaction as the
existing audit and lifecycle writes. Normal TOTP login remains audit-only;
suspicious/new-device detection is not implemented here. The unique
business event key derives from the persisted audit ID, not wall-clock
time or client input. The payload contains only the aggregate reference,
account ID and lifecycle action. No email address, raw token, OTP, secret
or recovery codes. Transaction failure rolls back audit and event together.
The database rejects duplicate keys; generic producer replay handling
remains part of #568.

The additive migration introduces the shared outbox (not a separate MFA
queue) with initial PENDING state, availability/lease indexes and
processing fields reserved for the dispatcher. Rollback application code
before removing schema; retain queued rows and audit evidence rather
than dropping the outbox after any event has committed. No SMTP or push
send, no recipient resolver, dispatcher, Inbox, delivery attempt or
retention worker is activated. PENDING means queued, not delivered or
read. #568/#569/#572 and #290 remain open. Revalidate the current verified
address and account eligibility before future delivery, follow the S05
security-notice policy and use the existing auth mail transport. Review
retention/access and missing-address fallback before release.

### TOTP challenge replay and rollback regression (#290)

The real PostgreSQL integration suite verifies that concurrent distinct
pending Admin sessions cannot both consume the same TOTP step. Exactly
one session rotates, one replay claim and one verified audit persist, and
the losing session stays pending. A missing keyring fails closed before
verification; an injected rotation failure rolls back the replay claim,
session changes and audit so the original pending session can retry.
This is internal service evidence, not a public enrollment/challenge
endpoint, multi-replica deployment test or authorization to activate MFA.
