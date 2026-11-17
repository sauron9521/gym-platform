# Offline-first workout drafts — safety foundation

**Status:** versioned, storage-neutral draft **contract only**. This PR does
**not** implement offline storage, process restart recovery, an upload queue,
a sync scheduler, or offline write delivery. It must not be advertised as
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
conflict and idempotency contract. This foundation adds no data persistence,
network access or third-party library.
