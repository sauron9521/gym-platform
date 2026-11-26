# Account workout preferences — incremental rollout

Status: proposed delivery contract; shared defaults merged in #898; server persistence and read/update merged in #899; conditional initialization merged in #900; mobile synchronization boundary merged in #901; mobile runtime integration implemented in this slice; native acceptance and release remain pending.
Baseline: mobile Zustand settings (#895) and timer scope (#892, #893, #896).

## Ownership

| Preference                                            | Authority after rollout                            | Current state                  |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| Auto-start rest timer                                 | Account API                                        | Account API + offline snapshot |
| Default rest duration (60/90/120 seconds, default 90) | Account API                                        | Account API + offline snapshot |
| Account language                                      | Existing account API                               | Unchanged                      |
| Theme                                                 | Existing device theme provider                     | Unchanged                      |
| Timer sound, vibration, keep screen awake             | Device-local account-scoped Zustand + AsyncStorage | Unchanged                      |
| In-progress countdown, manual workout preset          | Account/workout-scoped timer store                 | Unchanged                      |
| Units                                                 | Future account preference                          | Not implemented                |

Do not add a root store or move server entities into Zustand. The account preference
query and mutation lifecycle belong to TanStack Query. Existing durable local
preferences remain account scoped. A narrow adapter may expose effective values
to the timer and offline fallback without creating a second remote authority.

## API and storage

Use a dedicated authenticated current-user workout-preference resource,
`GET /users/me/preferences/workouts` and `PATCH /users/me/preferences/workouts`.
Do not modify the locale-only PATCH response or public profile/admin selectors.
The server derives identity from the authenticated actor; no client-supplied user
identifier. Reject unknown fields and unsupported durations. Use independent
nullable typed database fields initially; null means uninitialized, not false.
Effective defaults come from `@gym/domain`; the server returns stored values
and clients distinguish uninitialized fields from explicit choices.

A normal PATCH changes only explicitly supplied, validated fields; no empty
patch, implicit defaults for omitted fields, or unrelated device preferences.
Keep updates atomic with active account checks. The authenticated
`POST /users/me/preferences/workouts/initialize` accepts the same strict,
non-empty partial payload and returns canonical stored values with HTTP 200,
including on retry. Each supplied field is updated only if it is still NULL,
with both conditional updates and the read in one Read Committed transaction.
An explicit normal PATCH wins for overlapping fields regardless of ordering.
Concurrent imports cannot overwrite already initialized fields, and omitted
fields remain untouched. A no-op import does not update the account timestamp.

## Migration and failure behavior

- Existing installations keep all five v1 keys; do not bulk-delete them.
- For each uninitialized remote field, a valid explicit local value may initialize
  that field once, atomically. Missing/corrupt local values must not initialize
  the server. Never let an old device overwrite an already initialized field.
- Preserve local operation offline using last confirmed account values and the
  existing safe hydration rules. Until a dedicated offline mutation policy is
  implemented, require connectivity to change account preferences and surface
  failures instead of silently queuing or claiming success.
- On acknowledged writes update the account-specific query; fence delayed
  callbacks on logout/account switch and reconcile ambiguous outcomes by GET.
  Do not restart or reset a running timer on preference hydration.
- Keep legacy clients and the existing locale endpoint compatible. Do not
  release the mobile synchronization until the server contract and device
  migration acceptance gates pass. No background notifications or server countdown are in scope.

## Delivery slices

1. Shared pure domain defaults and allowed numeric presets; mobile consumes
   them without changing storage, UI or behavior (#898).
2. Typed nullable persistence and authenticated read/partial update contract,
   migration and generated OpenAPI client; verify old locale clients and
   account isolation (#899).
3. Conditional legacy initialization and concurrency tests (#900).
4. Mobile synchronization in two reviewable slices:
   - 4a. Typed GET query options and explicit online mutation transport,
     strict response validation, explicit legacy codec and separate
     account-scoped confirmed snapshot (#901).
   - 4b. Wire the verified-account runtime to the existing settings UI and
     timer with serialized writes, cache cancellation/reconciliation,
     durable snapshot ordering and reconnect/account-switch regressions.
     (this slice). The runtime uses the authenticated scoped API, and stores
     only effective values in Zustand. It pins the verified session marker
     during the active scope and fences callbacks when that marker is removed.
     Device preferences remain writable offline. Account writes are disabled
     until an online canonical read; ambiguous writes reconcile by GET and
     are not replayed. Confirmed snapshots use a separate v2 key and serialize
     writes per account. Native acceptance remains a release gate.
5. Web settings controls and parity; native acceptance and incremental rollout.

Units and reset behavior need separate decisions and implementation. In
particular, a reset of device settings must not silently reset account-wide
preferences or modify another device.
