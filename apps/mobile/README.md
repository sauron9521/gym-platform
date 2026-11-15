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

The `build` script exports the Expo web target for CI. It is **not** an iOS/Android binary
build. Native builds will be added later with EAS.

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
