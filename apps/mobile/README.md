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

For a physical device, copy `apps/mobile/.env.example` to `.env.local`
and set `EXPO_PUBLIC_API_URL` to the development computer's reachable LAN IP.
The Android emulator typically uses `http://10.0.2.2:3001`, rather than
`localhost`. Never put a secret in an `EXPO_PUBLIC_*` variable.

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

The home tab includes a gluestack-powered UI card and a button to the profile.
The next PRs will introduce TanStack Query, React Hook Form and Zod.

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
