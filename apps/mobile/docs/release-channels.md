# Native release channel isolation

**Status:** configuration and safety checks only. No APK, store submission, or
over-the-air (OTA) update is published or enabled by this PR.

| Profile | EAS environment | EAS channel | Artifact / destination |
| --- | --- | --- | --- |
| `development` | `development` | `development` | Internal development client |
| `preview` | `preview` | `preview` | Internal Android APK |
| `production` | `production` | `production` | Store distribution (auto-increment) |

A channel configured in `eas.json` does **not** enable OTA updates.
This repository does not install or configure `expo-updates` as part of this PR.

## Preflight before building or promoting

From the repository root, run
`node apps/mobile/scripts/release-channel-preflight.mjs`. It refuses unsafe
channel/environment crossovers, invalid artifact types, development profile
leaks, missing versions and non-store production builds. This is also covered
by contract tests in the normal mobile CI.

Run `node apps/mobile/scripts/native-staging-preflight.mjs` separately.
That check intentionally remains **NO-GO** until the operator supplies
reviewed Android package and iOS bundle identifiers in `app.json`.
Neither preflight verifies an actual EAS build, its app signature, API origin
or whether the linked EAS environments contain appropriate variables.

## Manual production promotion requirements

1. Establish ownership of Expo project, Android application ID, iOS bundle
   identifier, signing material, EAS credentials, and developer accounts.
2. Verify `EXPO_PUBLIC_API_URL` is HTTPS and points to the expected backend
   in each EAS environment. Never put secrets in `EXPO_PUBLIC_*`. Verify
   that preview targets staging and production targets production.
3. Build reviewed preview artifacts from `main`, verify commit, package ID
   and SHA-256, and run the manual staging Maestro authentication and
   workout read/write flows using disposable accounts.
4. Review permissions, privacy notices, deep links, localization,
   accessibility, crash handling, screenshots and app-store metadata.
5. Obtain explicit release approval and document store rollout, monitoring
   and rollback actions. Store rollout and server deployment must be
   coordinated independently.

For future OTA support, first install an Expo SDK-compatible `expo-updates`
runtime, define and verify `runtimeVersion` compatibility, configure
updates URLs and add real-device rollback/recovery tests. An OTA channel must
never be used to deliver JS that requires a different native binary.

**No automatic publish, EAS submit, or OTA workflow is introduced here.**
