# Gym Platform Mobile

Expo SDK 58 + React Native + Expo Router + TypeScript, as an isolated pnpm workspace.

## Get started

From the monorepo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @gym/mobile start
```

Use the Expo CLI terminal to launch Android or iOS. On Windows, Android Studio or a physical
Android device is supported; for iOS native simulators use macOS/Xcode or EAS Build.

```bash
pnpm --filter @gym/mobile android
pnpm --filter @gym/mobile web
```

Expo Go availability varies by SDK and store release. If Expo Go does not support SDK 58
on your device, use a development build.

## Quality checks

```bash
pnpm --filter @gym/mobile lint
pnpm --filter @gym/mobile typecheck
pnpm --filter @gym/mobile test
pnpm --filter @gym/mobile build
```

The `build` script exports both Expo web and **iOS JavaScript bundles** for CI. It does
not produce an iOS/Android binary or exercise an iOS simulator. Native binaries will be
built later with EAS.

Web export stores Metro's temporary bundles in `apps/mobile/.cache/expo-tmp/`
on the workspace drive. This avoids filling the Windows system temp drive when
the repository lives on another disk. The directory is ignored by Git and may
be removed when no export is running.

## Structure

- `src/app`: Expo Router routes and navigation.
- `src/screens`: screen components (FSD-friendly).
- `src/shared/ui`: platform-specific UI components.
- `src/shared/config`: visual tokens and shared configuration.

No additional Metro monorepo overrides are needed with modern Expo SDKs.
`ios/` and `android/` are excluded for Continuous Native Generation.

## Next steps

Implement training programs and workout sessions in small PRs.

## Live account capabilities (Mobile + Trainer)

Expo uses the **same account identity** as Athlete Web and Trainer Web, but
authenticates natively with short-lived Bearer access tokens plus a rotating
refresh token in SecureStore. The legacy `account.role` is display metadata,
**not** an authorization grant.

- Before unlocking private native navigation on sign-in, session restore and
  manual recovery, verify both `GET /users/me` and
  `GET /users/me/capabilities` against the Nest API. Accept only strict
  `{ athlete: boolean, trainer: boolean, admin: boolean }` payloads.
- A verified `ATHLETE` with approved TrainerProfile retains **both** athlete
  workouts/progress and trainer-athletes access; a revoked profile loses trainer
  navigation/queries without losing athlete access. ADMIN does not inherit
  either consumer product.
- On background/inactive, hide capability-gated navigation and clear private
  query caches; re-fetch live grants on foreground. A failed verification
  cannot reuse a stale grant or reopen a privileged screen.
- Revocation, resource ownership and IDOR checks are **always** enforced by
  NestJS; these Expo UI guards are defense-in-depth, not an API security policy.
- Real API regression: `apps/web/e2e/integration/mobile-token-capabilities.spec.ts`
  uses the **actual Expo bearer client and MobileTokenSession** with an
  in-memory SecureStore stand-in against disposable Nest/PostgreSQL and compares
  grants with the Web cookie identity. It checks approval/revocation, ADMIN,
  refresh rotation, independent browser logout and token revocation.
- **Not an emulator/device verification:** this integration spec cannot exercise
  actual iOS Keychain / Android Keystore, app lifecycle UI, or physical device
  transport. Manual/staging Maestro checks continue to cover those native
  behaviors. Never run the PostgreSQL integration spec against production DB.

## Native authentication and refresh-token rotation

- On iOS/Android, only the opaque **refresh token** persists in Expo SecureStore
  (iOS Keychain / encrypted Android Keystore). Access tokens stay in memory.
- On startup, the app reads the stored token and performs exactly one
  `POST /auth/token/refresh` rotation. Only a verified `GET /users/me` response
  unlocks protected navigation; a full-screen loading overlay hides sign-in
  during the attempt.
- When an access token approaches expiry, concurrent API requests share one
  refresh operation. Refreshes are **never automatically retried**: NestJS
  invalidates the entire token family if a spent token is reused.
- Rejected refresh tokens (401/403) clear the local session and all private
  TanStack Query caches. Network/5xx failures do not erase possibly valid
  stored credentials; they leave protected screens locked until revalidation.
- Logout clears tokens in memory and query caches immediately, deletes the
  stored credential, and best-effort revokes it via the API.
- On Expo Web, the token store is deliberately **memory-only**; no bearer
  credentials are written to browser storage.
- If a rotated refresh token cannot be stored, the local session is invalidated
  and the successor is revoked on a best-effort basis.
- iOS Keychain data can survive reinstalling the same app; use explicit logout
  and server revocation where appropriate.

The SDK 58 `expo-secure-store` native config plugin is enabled; Android Auto
Backup excludes SecureStore data automatically. A compatible development build
or Expo Go runtime is required on physical devices. JS-bundle CI does not
exercise actual iOS Keychain or Android Keystore behavior. Use HTTPS for
non-local API endpoints.

For a physical device, copy `apps/mobile/.env.example` to `apps/mobile/.env.local`
and set `EXPO_PUBLIC_API_URL` to the development computer's reachable LAN IP
(e.g. `http://192.168.1.20:3001`, replacing it with your real address). The
Android emulator typically uses `http://10.0.2.2:3001`, rather than
`localhost`. Never put a secret in an `EXPO_PUBLIC_*` variable.

### Login troubleshooting (native and Expo Web)

The Next.js app uses a same-origin `/backend` rewrite and cookie sessions,
while Expo talks directly to the API using `POST /auth/token`. A working
Next.js login therefore does **not** prove that Expo can reach the API.

1. For Expo Web at `http://localhost:8081`, add that exact origin to the
   **actual** `apps/api/.env` `CORS_ORIGINS` list and restart NestJS.
   The API applies the same explicit list to the built-in CSRF origin check,
   while retaining the narrower web-only cookie session trust policy.
   If Expo Web is served from a LAN address, explicitly add that origin too.
2. For a real phone on Wi-Fi, use your computer's LAN IP in
   `apps/mobile/.env.local`, not `localhost` or `10.0.2.2`.
   Make sure the API listens on the LAN interface and Windows Firewall permits
   inbound connections to the dev API on port 3001.
3. Restart Expo with `pnpm --filter @gym/mobile exec expo start --clear`
   after changing `EXPO_PUBLIC_API_URL`. Check that
   `http://<your-LAN-IP>:3001/health/live` loads from the phone's browser.
4. The sign-in error now distinguishes token issuance (API/CORS/network),
   protected storage (SecureStore), and profile verification (`/users/me`).
   On Expo Web, inspect DevTools Network for `POST /auth/token`; a blocked
   preflight suggests CORS, while a `403` on POST may indicate CSRF.

Never disable CSRF or configure wildcard CORS for a development workaround.
Do not post login responses, bearer/refresh tokens or passwords in issue logs.

## UI foundation (gluestack-ui v5)

Mobile UI components live under `src/shared/ui/gluestack` and are copied into the
app instead of being shared with the Next.js workspace. The stack uses gluestack-ui
v5, UniWind and Tailwind CSS v4; styling tokens are defined in `global.css`.
`metro.config.js` wires UniWind only into the mobile Metro bundler. The root
layout wraps Expo Router with the UI provider without removing auth route guards.

To add a component, run this from `apps/mobile` in a Unix shell or WSL
(the gluestack CLI still has limited native Windows support):

```bash
pnpm dlx gluestack-ui@latest add input --use-pnpm -y
```

Commit the generated component and the updated `pnpm-lock.yaml`. Keep the
`@/*` alias rooted at `src`; re-check `src/app/_layout.tsx` after running
`init` because the generator does not handle Expo Router guarded routes.

The app retains the Gluestack UI provider for overlay, toast and theme support.
Screens use their current React Native UI implementations. Unused generated Box,
Button and Text primitives are not kept as scaffolding; add a component when a
feature actually needs it.

## Mobile TanStack Query v5

The mobile app wraps authentication and navigation in `MobileQueryProvider`,
creating one isolated QueryClient. Defaults: 30 seconds stale time, 5 minutes
cache garbage collection and one retry for reads (none for mutations).
Android/iOS app focus events use React Native `AppState`; the web build uses
normal browser focus handling.

The profile uses the shared typed API via `useAccountQuery`, scoped to a user ID.
Successful login seeds the account cache from the verified `GET /users/me` call.
Logout clears tokens and **all query cache data** synchronously before remote
token revocation, avoiding cross-user data leaks. A genuine 401 signs the user
out; transient network errors and HTTP 5xx do not discard their credentials.

Future features should use feature-owned query hooks and query keys; do not
persist private query data in AsyncStorage or localStorage. Automatic token
refresh and offline detection will be handled separately.

### Workout set reconciliation on resume (#324)

The workout-details query is account- and workout-scoped. Returning to its
Expo Router screen triggers an **active read-only GET**, even if the cached
snapshot is younger than the default 30-second stale window. On Android/iOS,
`AppState` foreground and network-reconnect events also revalidate this query
unconditionally; background/offline/inactive-account focus does not issue a
private request. Other workouts are not invalidated.

During canonical refresh, the native details screen announces that the set
state is being checked and blocks set edits and workout completion until the
server response arrives. A failed refresh cannot silently advertise stale
confirmed data. A newer server snapshot also supersedes a locally acknowledged
PATCH response, including when the server reports the previous PENDING state.
Successful PATCH responses cancel overlapping GETs before updating the local
cache; an account check prevents reinstating private cache after sign-out.

**No PATCH is automatically retried or replayed** on screen focus, app resume,
or network reconnection. A lost write response must be reconciled with GET;
any subsequent write still requires explicit user action. This is _not_ an
offline write queue or a device-level E2E acceptance claim.

### Ambiguous workout-set writes: lost PATCH response (#324 follow-up)

A rejected HTTP 409/429 and an offline **preflight** are definitive failures:
no automatic GET reconciliation is needed for a request that the server rejected
or that the client never sent. Once a PATCH has been attempted, however, a
transport exception, HTTP 408/5xx, or HTTP 200 without a usable response body
**cannot prove the write was rejected**. These outcomes use an explicit
`WorkoutSetOutcomeUnknownError` rather than a generic "not saved" message.

For an unknown result, the mutation hook **never replays PATCH**. It invalidates
only the active account's current workout GET, checks the verified session
cache, and requests a read-only server snapshot if online and the workout
screen is mounted. Unsuccessful GET, offline or sign-out do **not** count as
verification. The pending GET remains eligible for an explicit screen-focus
or network-reconnect refetch from the previous reconciliation slice.

While the outcome is unverified, the row blocks both complete and skip actions
and announces why resubmission is unsafe. The UI releases that block only
after a **new successful canonical GET** for this account and workout. This is
tracked with a separate account-scoped `workoutDetailRead` counter, incremented
only by successful, non-aborted GET reads. The minimum required revision is
captured **after** the first failed verification (not at PATCH submission), so
a GET that raced with a lost response cannot accidentally release the lock;
a sibling set's PATCH cache update
cannot fake verification. After GET, the server-provided set status is shown;
any later change still requires an **explicit user press**. No private state
is persisted for replay or sent to analytics, and device-level interruption
acceptance remains separate from component tests.

## Windows + pnpm Expo Router entry

The mobile package uses its own `apps/mobile/index.js` entry file, which imports
`expo-router/entry`. Do not replace `main: "index.js"` with
`main: "expo-router/entry"`: resolving the package entry directly can cause
Metro to look for `./apps/mobile/node_modules/expo-router/entry` from the
**monorepo root** on Windows. Keep Expo Router's plugin and `src/app` routes.

If an existing local Metro server still uses a stale path, stop it and from
the repository root run:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @gym/mobile exec expo start --clear
```

To confirm the local pnpm installation exposes Expo Router:

```powershell
pnpm --filter @gym/mobile exec node -p "require.resolve('expo-router/entry')"
```

The `pnpm --filter @gym/mobile build:ios` command bundles **iOS JavaScript**
without Xcode, so CI detects native Metro entry failures as well as web errors.
It is not a substitute for device/simulator testing or an EAS build.

## Windows Metro development / isolated pnpm compatibility

Expo SDK 58 supports monorepos but some native Metro integrations fail under
pnpm's isolated symlinks on Windows. Typical symptoms include errors resolving
`expo/src/async-require/hmr.ts` or SHA-1 errors referencing
`apps/mobile/node_modules/expo/internal/async-require-module.js`. This repo
therefore uses Expo's documented fallback `nodeLinker: hoisted` in
`pnpm-workspace.yaml`. It applies to the **entire monorepo** (not just mobile);
do not add custom Metro resolver paths to work around these errors.

After pulling this change, stop Metro and run the following **from the repo root**
using PowerShell so pnpm can replace the old node_modules layout:

```powershell
Remove-Item -Recurse -Force .\\node_modules, .\\apps\\mobile\\node_modules -ErrorAction SilentlyContinue
pnpm install --frozen-lockfile
pnpm --filter @gym/mobile exec expo start --clear
```

The required `Mobile iOS Dev / Windows Metro` CI job now requests an actual
`dev=true` iOS JavaScript bundle on a Windows runner. A successful Linux
production `expo export --platform ios` alone does **not** test Fast Refresh
HMR or SHA-1 file-map resolution on Windows.

## Expo Web / React 19 theme initialization

The generated gluestack-ui v5 web provider originally rendered an executable
`<script>` tag inside its React component, which React 19 warns is not executed
on client-rendered pages. The web provider now applies theme classes in a
client layout effect, including immediately reading the OS theme on mount and
subscribing to its changes. This keeps the theme synchronized without rendering
a script element. Native iOS and Android provider logic is unchanged.

## React Hook Form + Zod 4 (sign-in)

The mobile app uses the same dependency versions as the Next.js web workspace:
`react-hook-form@7.92.0`, `@hookform/resolvers@7.0.5` and `zod@4.6.7`.
For React Native `TextInput`, use React Hook Form `Controller` (not DOM-style
`register`) together with `zodResolver` and a feature-owned Zod schema.
The sign-in schema lives in `src/features/auth/lib/login-flow.ts` and is also
used by the imperative auth service so input rules cannot drift.

Login shows **field-level** email/password errors and a separate **server**
error for HTTP/connection failures. Submitting or pressing the password keyboard
action validates first; subsequent edits clear stale server errors. Email is
trimmed but **passwords are never trimmed or persisted**. While the request runs,
the fields/button are disabled and a synchronous guard prevents duplicate API
requests. The existing verification-before-navigation and token handling remain
unchanged. Follow the same pattern for future React Native forms.

## Workouts list foundation

The protected `Тренування` tab fetches workouts through the generated
typed API client, scoped by account ID in TanStack Query. Pages load in batches
of 20 with FlatList infinite scrolling; status filters and pull-to-refresh use
separate query keys per account and selected status. Initial, empty, failed-page
and retry states are displayed, and 401 clears the local session. The athlete
creation action remains available alongside the list. The older manual refresh
button is also retained for accessibility and Maestro smoke tests.

## Workout detail and lifecycle (first vertical slice)

The authenticated workouts list now opens an individual workout route.
A typed, user-scoped TanStack Query loads its details; the first native
lifecycle controls start a planned workout and attempt to complete an active
workout. API conflict responses are surfaced safely (for example, unfinished
sets cannot be completed). Creating workouts, editing sets, cancel flows and
full history remain future slices. Live native/device testing is still required.

## Vitest contract and React Native component tests

Mobile uses Vitest 5 for both suites. `test:contracts` runs the Node-only
contract tests through `vitest.contracts.config.mts`; `test:unit` runs the
React Native component tests through `vitest.config.mts` and `vitest-native`
(`engine: 'native'`) with React Native Testing Library 14. Running `pnpm test`
executes **both** suites; Turborepo CI invokes this script for Mobile.

```bash
pnpm --filter @gym/mobile test:contracts
pnpm --filter @gym/mobile test:unit
pnpm --filter @gym/mobile test
```

The first component tests render `WorkoutDetailsScreen` through the real
React Native JavaScript renderer (native platform modules are mocked) and
exercise the status button with user events. This is not an emulator/device
or EAS smoke test. Existing Maestro native flows remain operator-driven.
Keep this pilot isolated to Mobile until CI and local Windows development
confirm the beta plugin works reliably with Expo SDK 58 / React Native 0.88.

## Retry profile verification after an offline launch

When refresh-token rotation succeeded but `GET /users/me` failed due to a transient
network/server outage, the sign-in screen offers a manual **Відновити сесію**
action. It reuses only the still-fresh in-memory access token for verification.
It never replays the already-consumed refresh token; expired or invalid sessions
require a normal sign-in. Protected navigation remains locked until a successful
verified profile response.

## Create workout (first native write journey)

A protected `/workouts/new` route uses React Hook Form and Zod for title,
exercise selection and a single planned-reps set. Exercises are loaded from
the typed GET /exercises API; POST /workouts writes through the bearer client.
Only verified success navigates back and invalidates the athlete's workout list.
The screen is available only for ATHLETE accounts and currently lists the first
20 accessible exercises, with a manual reload action on a read error.
A synchronous submit lock blocks duplicate presses. POST /workouts sends a
stable Idempotency-Key for manual retries of the same canonical payload:
a lost response must not create duplicate workouts. TanStack mutations are
never automatically retried. Additional exercise search, multiple
exercise creation, cancellation and advanced set editing are later PRs.

## Assigned training programs (first athlete mobile slice)

The athlete-only **Програми** tab reads the first 20 active training-program
assignments from GET /training-programs/assignments. The details route reads
GET /training-programs/assignments/{assignmentId}, including program workouts.
For an active assignment the athlete can create a workout through typed
POST /workouts/from-program and then open the created workout.

Manual retries for the same assignment/workout reuse a stable Idempotency-Key
until the server confirms success. A synchronous button lock blocks duplicate
taps; TanStack mutations never retry automatically. A successful creation
invalidates all cached workout-list filters for the account.

This is an initial assignment list with **no pagination beyond the first 20**.
Athlete and trainer roles are not interchangeable. The tab is hidden for
non-athletes and the details route is protected. Real-device navigation and
network-failure behavior still need physical-device testing.

## Exercise library (search and pagination)

An authenticated user can open the **Каталог вправ** from the home screen.
The protected `/exercises` route uses typed GET /exercises with 20-item
pagination, 300 ms debounced name search and independent muscle-group and
equipment slug filters. TanStack infinite-query keys include the signed-in
account and active filters, so old search results do not appear under another
user's session. Duplicate results across pages are hidden by exercise ID.

GET /exercises/muscle-groups and GET /exercises/equipment populate filter
choices, with per-resource error/retry states. A 401 response on any catalog
request clears the session; other transient read errors can be retried. Failed
next-page loads require manual retry to avoid repeated requests from FlatList
scroll events. Pull-to-refresh is supported. No editing or creation is exposed
by this first read-only library screen.

## Editing the athlete or trainer profile

The authenticated `/profile/edit` route offers display name, first and last
name, height and weight. React Hook Form and Zod validate measurements against
the PATCH /users/me API contract (50–300 cm; 1–600 kg with up to two decimal
places). Comma decimal input is converted before the request. Empty optional
fields are sent as null to clear them.

The editor hydrates the last verified GET /users/me response without
overwriting unsaved typing during refetch. The form blocks duplicate taps,
remains open on any PATCH failure, and navigates back only after server success.
The successful response immediately updates the account-scoped TanStack cache
and the profile query is invalidated for eventual refresh. Email, role and
security settings are intentionally not editable here.

## Workout progress dashboard (athlete only)

The protected `/progress` route reads the generated typed
GET /workout-analytics/summary endpoint and displays completed training
statistics for 7, 30 or 90 days. Each period has a separate account-scoped
TanStack Query cache. The API is athlete-only, so non-athlete users cannot
open this route or launch analytics requests. HTTP 401 clears the verified
session; HTTP 403 reports insufficient permissions without logging out.

The dashboard shows workout count, active days, completed sets, total strength
volume and a lightweight daily volume chart. Zero-volume days have zero-height
bars and an all-zero range displays an explicit empty-volume message. Offline
or server errors offer a manual retry; no other chart library is required.
This is a read-only summary; exercise-level performance charts and a device
smoke test remain follow-up work.

## Native network awareness and safe offline behavior

- Expo SDK 58 `expo-network@~58.0.5` reports device connectivity and
  integrates with the TanStack Query `onlineManager` on iOS and Android.
  Expo Web keeps its browser-native connectivity integration.
- A small offline banner warns when connectivity is unavailable.
  Reads pause through TanStack Query while offline and may resume on reconnect.
- **Mutations fail fast** offline (`networkMode: 'always'` plus an online guard).
  They are not automatically replayed after reconnect, avoiding duplicate
  set logging and workout creation.
- `expo-haptics@~58.0.8` gives native success feedback after saving a set;
  haptic errors never fail the mutation or affect Web.
- Private TanStack Query caches remain in memory only; neither tokens nor
  unverified workout writes are persisted in browser/AsyncStorage.
- This is a connectivity **foundation**, not a durable offline write queue.
  Durable drafts require conflict/version handling and explicit confirmation
  before replaying recorded workout changes.

These native modules may require updating development builds; JavaScript CI
does not verify the Android native APK or physical iOS vibration behavior.
