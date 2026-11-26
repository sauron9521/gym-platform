# Mobile crash monitoring and privacy-safe diagnostics (#350)

**Status:** M12.1 local integration boundary implemented. No vendor SDK,
external transport, persistent diagnostic queue or real collection is enabled.
Native crash monitoring, symbolication and production promotion are NOT RUN /
NO-GO. This is not a privacy/legal approval.

## Minimal version-1 contract

| Event              | Allowed fields                                                   | Origin                                                                                           |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| render_failure     | version=1, kind                                                  | Existing React render error boundary                                                             |
| api_server_failure | version=1, kind, HTTP 500–599 status, optional UUID-v4 requestId | Existing authenticated or unauthenticated mobile API fetch adapter, response header X-Request-ID |

The API generates the request UUID itself, ignoring client-supplied
correlation IDs. The mobile adapter only reads the named response header,
checks the UUID-v4 format and drops malformed/missing values. Format alone
cannot attest that a proxy or hostile endpoint actually generated the ID.
Only the approved isolated API origin/build is eligible for future
collection. Treat the correlation ID as pseudonymous operational data,
not anonymous data. Correlate with restricted server logs, never join a
diagnostic record to a customer profile in the vendor dashboard.

Strict runtime schemas reject extra fields. Never provide exception messages
or arbitrary exception objects, stacks, component props, request URL/path/
query/body, response body, auth headers, cookies, access/refresh tokens,
MFA codes, account/device identifiers, workout details, screenshots,
location or interaction breadcrumbs to this event port. Expected 4xx,
network errors and aborted requests are not captured by this slice.
Existing authentication/error handling and response bodies stay unchanged.
The render fallback still allows explicit UI recovery.

## Activation and lifecycle

The singleton has no configured sink in any shipped environment. An isolated
in-memory port permits an explicitly permitted preview configuration only.
This is a programming contract, not a verified runtime environment or consent
authority: a future integration must independently validate preview build
identity, trusted configuration, approved destination and user/operator
permission. Do not enable from a user-controlled URL or arbitrary public env
flag alone. Do not wire a sink before the gates below.

The port caps each configuration epoch at 20 attempted deliveries, allows one
in-flight delivery, drops rather than queues additional events and swallows
sink failures. No storage, retry, replay or account state is retained.
Revocation disables immediately, aborts the current signal and rejects late
responses from previous epochs; the future sink must honor cancellation.
Already transmitted data cannot be recalled by abort. A native SDK may have
its own queues or crash files; their deletion/consent lifecycle must be
verified independently. A UI error boundary is not an OS-level crash handler.

## M12.2 — reviewed build integration, then SDK

1. Resolve #348: approved Android package/iOS bundle IDs, isolated EAS
   preview environment, verified signed/internal binaries, authorized
   staging API and real Android/iOS device evidence.
2. Review S03/S04/S05/S07 lawful basis, independent consent/withdrawal
   where applicable, vendor/processor, region, retention, deletion,
   role-based access and privacy disclosures. Define allowed diagnostic
   categories and a separate approved stack-frame schema; no automatic
   unrestricted capture.
3. Verify the exact installed Expo/RN version against the selected
   @sentry/react-native release, config plugin, Metro source-map pipeline
   and native symbol upload. Pin reviewed versions and review dependency
   and native configuration diffs. No speculative SDK dependency now.
4. Keep development, test, preview and production isolated. Preview must
   use a separate project and reviewed destination. Upload credentials
   remain build-only secrets, never EXPO_PUBLIC_* or embedded in JS/native
   app. Production remains disabled until separate owner approval.
5. Review the SDK's default integrations and native behavior: disable
   identity, IP collection where supported, automatic breadcrumbs,
   HTTP bodies/headers, screenshots, replay, profiles, tracing and
   attachments unless separately approved. Reconstruct event payloads from
   an allowlist before delivery; verify native fatal events that may not
   traverse a JS hook, SDK-generated device/context metadata, disk queues,
   debug logs, transport headers and retry behavior. If a path cannot be
   minimized or revoked reliably, do not activate that path.
6. Bind the preview-only adapter and explicit permission lifecycle after
   these gates. Treat symbolication as a separate reviewed schema: only
   approved code frames and build/debug identifiers, no free-form
   exception text or local source paths/variables. Do not infer actual
   SDK support from configuration names.

## Required preview evidence

On Android and iOS separately, use synthetic staging data and authorized
preview artifacts. Record reviewed commit, app/build ID, artifact hash,
OS/device and matching source-map/native-symbol release. Verify one
controlled JS render failure, one controlled native fatal crash and
symbolicated frames in the isolated vendor project, without test-only crash
actions in production. Check a staging HTTP 503 maps to its server-generated
request ID in restricted API logs. Use synthetic sentinel tokens, emails,
workout titles, notes and route IDs; inspect actual outbound envelopes and
stored vendor events for any leakage (including SDK-generated metadata).
Test disabled-by-default, missing config, denied/revoked permission,
in-flight requests, offline/online, crash restart, account switch and
environment separation. Verify no unexpected sends on dev/test/prod builds.
Record only sanitized evidence, never raw credentials, payloads or real
user data. If inspection or a native build is unavailable, record NOT RUN.

Keep #350 open. Native crash reporting is not implemented or validated by
M12.1. Do not deploy, enable a real sink or approve production from local CI.
