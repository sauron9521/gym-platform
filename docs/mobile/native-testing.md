# Native release and E2E foundation

Gym Platform Mobile uses **EAS Build** for signed iOS/Android binaries.
The existing `pnpm --filter @gym/mobile build` exports JavaScript bundles,
not installable native applications.

## Prerequisites

1. Choose unique Android application ID and iOS bundle identifier. Configure
   them in `apps/mobile/app.json` before attempting a native build. No IDs are
   fabricated or committed in this PR.
2. Configure and sign in to your Expo/EAS project. From `apps/mobile`, use
   `eas build:configure` after installing the EAS CLI. Preserve the reviewed
   `preview` and `production` profiles in `eas.json`.
3. Configure `EXPO_PUBLIC_API_URL` for the EAS **preview** environment to point
   to a reachable HTTPS staging API; this is embedded in the application bundle.
   Never use a production database or production credentials for smoke tests.
4. Create a disposable, verified staging test account, and install Maestro and
   a native preview build on a dedicated Android/iOS device or simulator.
   Internal iOS device builds require appropriate Apple signing/provisioning.

## EAS native builds (operator-driven)

From `apps/mobile`, after configuring identifiers, the EAS project and signing:

```bash
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

The `preview` profile uses internal distribution, not app-store release.
Production uses **remote** EAS app-version management with auto-incrementing
build numbers, avoiding local version-file changes at build time. Confirm
store identities, provisioning and release credentials before any production
build or submission. Never commit signing keys or staging passwords.

## Maestro smoke (operator-driven)

The flow assumes a fresh staging session and checks sign-in, authenticated
navigation to Profile, and sign-out using stable native `testID` selectors.
It resets app state before launching; use a dedicated test device because a
reset removes local app data. On iOS, Keychain data may survive reinstalling;
use a disposable account and revoke stale sessions when necessary.

From the **repository root**, with `APP_ID`, `E2E_EMAIL` and
`E2E_PASSWORD` already set from a secure local source:

```bash
maestro test \
  -e APP_ID="$APP_ID" \
  -e E2E_EMAIL="$E2E_EMAIL" \
  -e E2E_PASSWORD="$E2E_PASSWORD" \
  apps/mobile/maestro/flows/auth-smoke.yaml
```

Do not print test secrets, commit them, or upload unredacted Maestro debug
artifacts/screenshots. Environment parameters are passed to Maestro only when
running the command; they are not set up by repository CI.

This PR verifies release-config and flow **contracts only**. Neither EAS
signed native builds nor real-device Maestro tests run in CI yet; do not
interpret a green JS/Metro export as native E2E validation.
