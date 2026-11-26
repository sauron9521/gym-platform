# Offline-first workout drafts — safety foundation

**Status:** versioned draft contract and storage-neutral repository boundary.
No production storage adapter, restart recovery, upload queue, sync scheduler,
or offline write delivery exists yet. It must not be advertised as
support for saving workouts without connectivity.

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
