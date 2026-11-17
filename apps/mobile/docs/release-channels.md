# Native release channels

Status: **configuration and policy only; neither APK nor OTA update has been published.**

- `development`: locally controlled development client.
- `preview`: EAS environment `preview`, internal Android APK and dedicated
  update channel `preview` (reserved until expo-updates is correctly installed).
- `production`: EAS environment `production`, dedicated channel
  `production`, version auto-increment.

Run `node apps/mobile/scripts/release-channel-preflight.mjs` for channel
separation and `node apps/mobile/scripts/native-staging-preflight.mjs`
(after PR #194) for Android/iOS package identifier checks.

A production release requires **all** of:
1. Approved Android package and iOS bundle identifiers, Expo project linkage,
   signing ownership, Apple/Google developer accounts, and reviewed permissions.
2. Native build with EAS, test login against HTTPS staging, and complete
   manual Maestro read/write flows on a disposable staging account.
3. Privacy policy, consent, deep link and accessibility checks, device crash
   diagnostics, app-store metadata and screenshots.
4. Documented rollback and staged promotion. Do not enable OTA updates before
   installing the SDK-compatible updates runtime and confirming runtimeVersion
   compatibility; OTA cannot roll back an incompatible native binary.

Never embed production secrets or tokens in `EXPO_PUBLIC_*` or ship a staging
build wired to production API. No automatic publish action is added here.
