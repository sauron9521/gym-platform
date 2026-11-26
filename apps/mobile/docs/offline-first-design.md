# Offline-first workout drafts — safety foundation

**Status:** encrypted native adapter, verified auth lifecycle and explicit
local-only draft UI implemented. Version 2 submission reservations and receipts are supported, with explicit reviewed network submission and separate acknowledged cleanup.
Native device acceptance remains outstanding. No offline login, background
upload queue or automatic write delivery exists.

## Existing API/form compatibility

`offline-workout-draft.ts` reuses the **already-shipped**
`mobileMultiWorkoutFormSchema`. The stable envelope includes
`schemaVersion: 1`, a validated `ownerId`, `savedAt`, and
`state: REQUIRES_REVIEW`. Deserialization rejects malformed data, unknown
versions, unsupported fields, invalid workout form contents and drafts
belonging to another account. It is deliberately independent of React Query.

`canSendReviewedDraft` is an eligibility predicate, **not** a network write:
it returns false unless a valid draft belongs to the active account, the
client is online and the user has explicitly confirmed after review. The
existing workout POST remains online-only with its own idempotency handling.

## Before implementing persistence or synchronization

1. Choose and audit an Expo-compatible storage provider. Validate encryption
   at rest, OS key handling, backup behavior and data lifetime before storing
   sensitive workout data. Reassess the threat model on real Android/iOS.
2. Namespace records by **verified account ID**; do not mount private drafts
   from another account. Clear the account's records on logout, account switch
   and applicable deletion requests. Design migration for `schemaVersion`.
3. On rehydration, validate with `parseOwnedWorkoutDraft` **before** exposing
   the draft to React state. Provide an explicit review screen; never send
   simply because connectivity returns.
4. Require fresh server-side authorization, exercise visibility and version
   checks when resuming an operation. Define conflict handling, idempotency
   keys and safe recovery after ambiguous network results.
5. Test restart, device restore, corrupt storage, role/account changes,
   token refresh, concurrent devices, stale entities, retries and deletion on
   real devices. Keep telemetry free of workout details and credentials.

**No automatic replay** is permitted without an agreed server revision,
conflict and idempotency contract. This foundation adds no production data persistence,
network access or third-party library.

## M10.1 — storage boundary and threat model (#345)

The scope is **one validated new-workout draft per verified athlete account**.
The existing version 1 envelope accepts complete valid forms, not arbitrary
unfinished input, performed-set updates, access/refresh tokens, or server
revision tokens. A later product/schema decision is needed for partially filled
forms and active-workout drafts. No persistence or sync is enabled by this slice.

### Storage decision and release gates

Issue #345 specifies Expo SQLite after a threat model. Select Expo SDK 58
`expo-sqlite` with SQLCipher for the next implementation, subject to the native
build and dependency review. Plain SQLite, AsyncStorage, browser storage, and
silent fallback are not acceptable for private workout contents. The repository
port is deliberately not an encryption implementation.

- **At rest:** enable SQLCipher in the native config, verify a nonempty
  `PRAGMA cipher_version` before initializing any private database, then apply a
  cryptographically random key and verify access to the database before writing.
  Wrong key, unsupported cipher, key loss or failed migration must fail closed;
  never recreate an existing unreadable database with a new key automatically.
- **Key lifecycle:** use OS-backed secure storage for random per-install or
  per-owner keys (prefer per-owner keys for scoped deletion); never store keys
  alongside ciphertext or derive them from account IDs/passwords. Validate
  Keychain accessibility, Android backup exclusion, database/WAL/SHM and backup
  policies, reinstall behavior, and deletion on Android and iOS.
- **Identity:** only unlock from a freshly verified athlete session. Background
  or capability loss locks immediately and removes any exposed UI draft.
  Explicit logout/account switch purges the previous account before another is
  unlocked; failed deletion keeps the draft subsystem locked. No implicit grant
  of server write authorization from local state.
- **Crash recovery:** the adapter/lifecycle integration must persist a minimal
  encrypted cleanup/ownership marker, reconcile interrupted deletion before
  exposing data on cold start, and clear obsolete account records. In-memory
  ownership and the repository queue alone do not survive process death.
- **Tampering/availability:** validate version, owner, strict schema and bounded
  size on read and write; corrupt/unknown data is not silently replaced or
  deleted. Explicit discard and migration/recovery require separate handling.
  Surface generic failures without payloads, database paths or secrets.
- **Replay:** no online/background worker, automatic upload, or offline PATCH.
  Preserve existing server authorization and idempotency; the existing draft
  policy continues to block updates without a verified matching revision.
- **Limits:** encryption mitigates offline data extraction, not a compromised
  device, malicious code in a running unlocked process, screenshots, or a
  privileged OS attacker. Do not promise protection against those threats.

Official SDK 58 references:
[SQLite / SQLCipher](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher)
and [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/).
SQLCipher is not supported in Expo Go; an unrecognized PRAGMA can be ignored
without error, so a real cipher check and development/staging binary are required.

### Repository contract and acceptance sequence

`OfflineDraftRepository` serializes reads/writes/deletion and gates them using
an explicit verified owner and a generation. Lock invalidates pending results;
purge queues deletion behind any in-flight write and rejects new owner unlocks
until deletion succeeds. The caller must use one instance, wire auth lifecycle
and clear UI state. Tests use a fake in-memory adapter, not native persistence.

| Slice | Acceptance                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M10.1 | Storage port, owner gate, validated envelope, serialized cleanup, fake-adapter tests and threat model.                                                 |
| M10.2 | Native encrypted adapter, schema migration, key lifecycle, crash-safe cleanup marker, fail-closed web/Expo Go; coordinated dependency/lockfile change. |
| M10.3 | Auth integration, explicit save/load/discard and review UI; no automatic POST/PATCH.                                                                   |
| M10.4 | Explicit reviewed creation with durable idempotency/reconciliation design; active-workout update remains blocked without server revisions.             |
| M10.5 | Android/iOS device evidence: encrypted at rest, kill/reopen, corruption, failed deletion, account switch, logout, backup/reinstall, network ambiguity. |

Keep #345 open until its actual device acceptance criteria are satisfied.

### M10.2 — isolated encrypted native adapter

The native implementation uses one fixed private database file (not an account
ID in a filename), one validated owner, and a randomly generated 256-bit key
stored in a device-only SecureStore marker. Three marker states are used:
`provisioning` (key saved before creating the database), `ready` (schema
initialized), and `purging` (durable deletion intent without the stored key).
Only a successful `prepareVerifiedOwner` admits reads/writes for that owner.
The adapter serializes operations, closes each connection, disables the SQLite
devtools registration, verifies cipher availability in memory before opening
the disk file, checks the keyed database and schema version, and uses bound
parameters for draft contents. Unknown versions, wrong keys, missing ready
files, orphan files, corrupt markers and close failures fail closed. Version
0 is initialized only for an empty provisioning database; future migrations
require an explicit implementation and tests. There is no browser fallback.

Owner switching and cold-start logout require `prepareVerifiedOwner` and
`purgePersistedOwner` respectively. The upcoming auth integration must
coordinate these with the repository generation, block UI before async cleanup,
and retry failed cleanup explicitly. Purge persists intent before removing
the database, journal, WAL and SHM files, checks that they are absent, then
deletes the SecureStore marker. A marker without a key never permits reads.
An orphan file with no marker is locked rather than silently discarded; define
an explicit recovery/reset flow before release. Secure deletion is not a
forensic erasure guarantee on flash storage.

**Release blocker:** mocked native-module tests exercise the control flow,
not the cryptographic implementation, file/Keychain behavior or filesystem
durability. On a rebuilt Android/iOS binary, verify actual encrypted file
contents, incorrect-key rejection, kill/reopen, schema rollback, interrupted
purge, account isolation, OS backup/restore and reinstall behavior. Backup
exclusion and native key-loss/locked-device handling remain device/release
gates. No UI wiring or offline POST/PATCH is enabled by this PR.

### M10.3a — auth lifecycle coordination

The composition root injects a stable private-data lifecycle port into AuthProvider.
Only fresh athlete grants and active AppState permit repository unlock. Background,
foreground revalidation and provider unmount lock synchronously and invalidate
in-flight results; transient verification failures retain encrypted records but
never expose them. Explicit logout, rejected refresh, definitive permission loss,
trainer-only grants and cold start without a stored credential request cleanup.
Credential rejection invalidates UI before SecureStore deletion finishes.
The coordinator serializes cleanup and new owner preparation, waits for in-flight
repository writes, and refuses new access when deletion fails. Storage failures
do not block ordinary online authentication. Native storage is loaded lazily so
missing native modules and Web fail closed rather than preventing sign-in.

M10.3b will expose explicit save/load/discard/review UI, a reactive lifecycle
state and a safe cleanup retry flow. The current coordinator is not a user-facing
feature; no draft is created or exposed automatically. Only valid new-workout
forms are supported by the existing versioned envelope. Device QA remains open.

### M10.3b — explicit local draft form

The existing new-workout screen exposes a themed Ukrainian/English local-draft
panel. Storage availability follows a reactive generation-scoped lifecycle
snapshot. A ready session checks whether a draft exists without applying its
values. Save validates the existing version-1 complete form, restore and
discard require explicit confirmation, and any local operation is serialized
against the ordinary online submit. A restored or saved form is bound to its
current generation; lock/account change clears it, including React Hook Form
defaults. Late reads and stale confirmation callbacks cannot populate a new
session. The route is keyed by verified account ID and independently requires
athlete grants.

This slice intentionally does not let the existing in-memory idempotency POST
submit a saved/restored draft. Until M10.4, a stored draft blocks ordinary
creation while it exists and must be explicitly discarded to start a new
workout; discarding a bound form resets it. A normal POST attempt also disables
draft actions for that screen, so an uncertain response cannot be converted into
a local draft. Storage failures use generic messages and require recheck or
explicit discard. If native encrypted storage is unavailable, ordinary online
creation remains available without exposing persisted contents or using a
plaintext fallback. Cleanup-required status directs the user to sign out and
sign in again; no recovery/reset of orphan files is enabled.

Known scope: one validated new-workout draft, not a partially filled form, a
completed-set log, an offline login, or a background sync queue. Drafts are
not automatically restored or submitted. The screen still requires the
existing verified athlete session and exercise catalog access. Device-level
encryption, persistence, backup, cleanup and UX acceptance remain release
gates. Keep #345 open.

### M10.4a — durable reviewed submission reservation

The server's existing manual workout creation uses a unique
`(athleteId, idempotencyKey)` constraint and a canonical request fingerprint.
Same-key/same-body replay returns the original workout representation;
same-key/different-body conflicts. No server API changes are necessary for
this storage slice.

Version 1 review-only records remain readable and writable. Version 2 adds
`SUBMISSION_PENDING` (UUID-v4-based URL-safe key and frozen canonical
POST body JSON) and `SUBMISSION_ACKNOWLEDGED` (same key/body and the
validated server workout UUID). The repository reserves only an already saved
matching form with explicit review and online eligibility, writes and reads
back the pending record before returning it, and reuses the exact same
key/body after reopening. The future transport must use the frozen body,
not a mutable form, and must recheck the current verified athlete session,
generation, connectivity and confirmation before sending. A future body
builder change needs explicit migration/reconciliation; never create a new key
for an unreadable or conflicting pending request.

Ordinary save/discard cannot overwrite or remove pending/acknowledged records.
Invalid or unreadable records fail closed rather than being discarded as
ordinary drafts. The trusted transport must validate a matching 201 response
before recording an acknowledgment; acknowledgment itself is persisted and
read back before separate explicit cleanup. Failed cleanup must not cause a
new POST. A storage failure or stale generation never authorizes sending.
Account logout/purge still removes private local data per the approved privacy
policy, including reservations: retry protection does not survive intentional
purge, uninstall, device loss or external deletion of the server record.
Do not claim global exactly-once delivery.

M10.4b must implement a single explicit reviewed send flow, secure UUID
generation, fresh scope checks, same-key retry after ambiguous responses,
receipt validation, acknowledged cleanup recovery, and appropriate UI for
pending/acknowledged states. No transport or UI sends are enabled in M10.4a.
Mocked storage tests are not evidence of physical-device crash durability.

### M10.4b — reviewed submission and acknowledgment

The draft panel permits submission only after the saved form has been explicitly
restored or saved, reviewed and confirmed, with the current owner generation,
verified athlete grants and online state. Changes must be saved before sending;
the repository compares the canonical body. The transport uses an Expo Crypto
UUID-v4 key, persists and reads back the reservation before the first POST,
and sends exactly the frozen body. The scoped auth client checks session
revision and the operation guard before and after token acquisition. The
coordinator serializes sends across screens and rechecks owner scope before
accepting a 201 receipt whose workout UUID and athlete ID match expectations.

An ambiguous response, invalid receipt or failed acknowledgment leaves the
durable reservation in place. Recovery is read-only until the user explicitly
restores/reviews and confirms another same-key POST. There is no auto retry or
online-event replay. Pending data is read-only and ordinary discard/save are
blocked. A confirmed receipt permits only explicit local cleanup; if removal
partially fails after destroying the key, same-generation cleanup can retry
using the already validated receipt, without re-reading ciphertext or sending
another POST. Native preparation resumes a durable interrupted purge on a
later verified startup/foreground. Logout/owner purge still clears local
private data, including pending reservations. No guarantee of global
exactly-once behavior across device loss or deliberate server deletion.

The tests cover mocked native storage and transport; actual SQLCipher,
filesystem, backup/restore, lost-response staging API and device restart
acceptance are still required for #345. Offline login, unfinished-form/active
set logs and automated sync remain outside this slice.

### M10.5 — native acceptance handoff

See [Offline draft native acceptance](native-staging-smoke.md#m105--offline-draft-native-acceptance-345)
for the guarded Android dispatch and manual iOS Maestro flows (resume,
commit-then-drop response, account isolation), the separate offline/SQLCipher/
key lifecycle/backup/cleanup checks and the required private evidence.
Prepared scenarios are not executed device evidence. Keep #345 open and
native promotion NO-GO until all required checks pass.
