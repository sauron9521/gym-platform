# Offline workout drafts — safety-first integration proposal

This preparatory change ships a **pure guard and tests, not working offline storage**.
It must not be described as an offline-first implementation or as automatic replay.

## Scope boundary and existing independent draft helper

The already-merged `offline-workout-draft.ts` provides a storage-neutral schema,
owned parsing, and `canSendReviewedDraft`, which is **only a preliminary form
eligibility check**. It does not validate verified session freshness, network
write outcome, or authoritative API revision. It must **never** be interpreted
as network mutation authorization. This policy is a separate prerequisite,
not wired into that helper or into a sync service in this PR.

No caller currently has an authoritative remote revision contract to satisfy
this policy. Do not fabricate or reuse local timestamps as server revisions;
future integration must check both preconditions and revalidate on the server.

## Existing guarantees

- Mobile query data and credentials are not persisted in AsyncStorage.
- Expo SecureStore currently persists refresh credentials only.
- Mutations fail fast when disconnected. Successful writes are verified by the API.
- Workout creation already accepts idempotency keys; set updates need explicit conflict management.

## Planned next vertical PRs

1. **Schema and storage threat model**: choose encrypted local storage on native
   (SQLite alone is not encryption); scope drafts to a verified user and a known
   workout/assignment. Avoid tokens and sensitive details in logs/backups.
2. **Manual draft creation**: persist only a local, clearly labeled unsynced draft.
   No server side-effects while offline. Clear or lock drafts on logout/account switch.
3. **API revision contract**: implement conditional update/version tokens under
   transactional row locks, return an explicit conflict on stale remote state.
   Update generated OpenAPI client and tests before enabling upload.
4. **Read-before-write, user-confirmed sync**: fetch authoritative remote state and
   compare the draft's base revision, require explicit confirmation to submit,
   and retain drafts on ambiguous request failures. Never retry a spent token or
   a non-idempotent mutation automatically.
5. **Device QA**: airplane mode, process restart, offline editing, login as another
   account, token expiry, a write accepted with lost response, concurrent edit on
   second device, app reinstall and crash recovery.

## Current guard

`evaluateOfflineDraftSync` is a fail-closed pure policy over session ownership,
connectivity, known remote revision and uncertain previous writes. It only
returns `requires-confirmation` when all prerequisites are met, and never
performs a write or returns an authorization. Missing/invalid runtime flags,
blank owner IDs, and missing or whitespace revision tokens fail closed. A future sync
service must enforce this policy and recheck all server invariants.

No persistence, API migration, background queue or dependency is added here.
