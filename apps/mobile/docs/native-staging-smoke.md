# Mobile native staging smoke (EAS Preview + Maestro)

This is a **manual**, authenticated Android-emulator smoke, not part of normal PR
CI. The iOS JavaScript Metro check does **not** build or launch an Android APK.
Do not use production API endpoints, users, signing keys, or live accounts.

## One-time configuration

1. From `apps/mobile`, connect the Expo project with `eas init`. Set the
   actual Android `expo.android.package` in app configuration and verify its
   ownership. No package name, Expo project UUID, or signing credential is
   generated automatically in this PR.
2. In Expo EAS, configure the `preview` environment's **public**
   `EXPO_PUBLIC_API_URL` to your own **HTTPS staging API**. The app embeds this
   URL at build time. Check it using `eas env:list --environment preview`
   and confirm it is **not production**. Do not store secrets in
   `EXPO_PUBLIC_*` variables.
3. In GitHub, create the `mobile-staging` environment. **Restrict deployment
   branches to `main`**, enable required reviewers, and add environment
   secrets `MOBILE_E2E_EMAIL` and `MOBILE_E2E_PASSWORD` for a disposable
   athlete account belonging only to staging. These secrets are not used by
   ordinary CI.

## Create and verify a preview APK

1. On reviewed `main`, from `apps/mobile` run:
   `eas build --profile preview --platform android`. The preview profile
   selects EAS environment `preview` and produces an installable Android
   **APK**, not an Android App Bundle or dev-client build.
2. Confirm the finished EAS build belongs to **your** Expo project, built from
   the reviewed commit, has the expected staging API and Android package ID.
   Copy the direct artifact URL, for example
   `https://expo.dev/artifacts/eas/EXAMPLE.apk` (not an arbitrary URL or
   a signed URL with query parameters).
3. Independently download that **same APK** from the trusted EAS build details
   and compute its SHA-256:
   `sha256sum ./gym-platform-preview.apk` (Linux/macOS/WSL), or
   `(Get-FileHash .\gym-platform-preview.apk -Algorithm SHA256).Hash`
   (PowerShell). Record the 64-digit digest. **Treat the URL and digest as a
   pair** and do not take them from an untrusted PR comment.

## Run and interpret the smoke

1. Run **Mobile native E2E / Maestro (manual)** on the `main` branch.
   Enter the trusted direct EAS APK URL, its **SHA-256**, the manifest's
   **Android application ID**, and `auth`, `workouts`, or `session-restore`.
2. The workflow rejects non-Expo hosts and malformed inputs before loading
   secrets; only HTTPS transfers are allowed. It downloads the APK, checks
   SHA-256, and checks the manifest package ID **before installing** it.
   The fixed Maestro CLI version is `2.12.1`.
3. Maestro logs in with a disposable account on an Android emulator. The
   `session-restore` flow checks that SecureStore persists across an app
   stop/relaunch, protected routes reopen, and explicit logout clears access.
   The `workouts` flow checks the read/refresh path; it does not mutate
   workout data. Inspect run results: any failure is **NO-GO** for promotion.

**Security boundary:** an Expo-hosted artifact URL alone is not proof the APK
belongs to your project. Required environment approvals, a verified EAS
build/commit and its independently confirmed checksum are essential. Never
accept a package from another Expo project, even if it has a valid URL and hash.
Do not upload full Maestro screenshots/logs containing account information to
public CI artifacts. Disable or rotate the disposable staging credentials after
testing if they may have been exposed.

This PR only configures the optional workflow and contracts. A genuine EAS
build, a running staging backend, and an emulator test require operator-provided
infrastructure and secrets; **a passing normal CI is not evidence of a
successful native smoke run**.

## Automated local EAS configuration preflight

Before requesting the manual preview APK build, run `node apps/mobile/scripts/native-staging-preflight.mjs` from the repository root. This command deliberately fails until the owner provides approved Android/iOS package identifiers in `app.json`. The repository does not invent public application IDs or signing keys. The preflight also verifies that the preview artifact is an internal APK bound to EAS `preview`, with independent production versioning.

Passing the configuration preflight **does not** verify a real device build, staging HTTPS, package ownership or Maestro execution. Those remain manual operator requirements.
