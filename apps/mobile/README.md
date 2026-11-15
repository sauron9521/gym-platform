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

Implement SecureStore-backed refresh-token rotation, training programs and workout sessions in small PRs.

## Native authentication (first functional slice)

- The sign-in screen calls `POST /auth/token` with the shared typed bearer client.
- Protected routes unlock only after `GET /users/me` successfully verifies the token.
- Profile shows authenticated user data, supports refresh and sign-out.
- Sign-out clears tokens locally and best-effort revokes the refresh token via
  `POST /auth/token/revoke`.
- Access and refresh tokens remain **in memory only**. This first PR deliberately
  avoids insecure storage; restarting the app requires another login and there
  is **no automatic token refresh yet**.
- A follow-up PR will add `expo-secure-store`, safe refresh rotation,
  persisted login and native authentication lifecycle tests.

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
