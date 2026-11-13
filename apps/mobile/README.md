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

## Structure

- `src/app`: Expo Router routes and navigation.
- `src/screens`: screen components (FSD-friendly).
- `src/shared/ui`: platform-specific UI components.
- `src/shared/config`: visual tokens and shared configuration.

No additional Metro monorepo overrides are needed with modern Expo SDKs.
`ios/` and `android/` are excluded for Continuous Native Generation.

## Next steps

Connect the generated API client and implement authentication, user profiles,
training programs, and workout sessions in small PRs.

## Native authentication foundation

`src/shared/api/client.ts` now accepts a required `getAccessToken`
callback, attaches bearer credentials only for the API's configured origin,
and reports 401/403 separately. No token storage, refresh, or logout
behavior is implemented by this adapter: supply a short-lived token reader
from a later secure storage/auth module. Mobile does not send cookies.
