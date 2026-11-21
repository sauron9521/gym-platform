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

Before requesting the manual **Android** preview APK build, run
`node apps/mobile/scripts/native-staging-preflight.mjs --platform android`
from the repository root. It requires an owner-approved `expo.android.package`
but **does not require the unrelated iOS bundle ID**. For iOS-only setup use
`--platform ios`; the default with no flag checks **both** platform IDs.
Unsupported platform flags fail closed. The preflight also verifies the
relevant preview profile, internal distribution, EAS `preview` environment,
and independent production versioning; it does not invent application IDs or
signing keys.

**The Android preflight does not link your Expo project or check the EAS cloud**.
Before building, log in to your own Expo account, link the reviewed project
(`eas init` / approved project ID) and set `EXPO_PUBLIC_API_URL` in the EAS
`preview` environment to the actual **HTTPS staging-only API**. The public URL
will be embedded in the APK; do not set it to localhost or production. Review
all generated config changes in a separate PR before using a production deploy
key. Actual GitHub `mobile-staging` environment **required reviewer and main-only
branch restrictions** must be created manually before running the dispatch;
GitHub does not have these protections when the environment does not exist.

Passing the configuration preflight **does not** verify a real device build, staging HTTPS, package ownership or Maestro execution. Those remain manual operator requirements.

## Optional staging-only mutating workout smoke

The `workout-write` option adds a **manual** end-to-end write journey:
log in as the disposable staging athlete, search for a seeded exercise, create
one workout, start it, record a completed set and finish the workout.
This is **not** part of pull-request CI.

Before enabling it, configure the `mobile-staging` GitHub environment:

- `MOBILE_E2E_EXERCISE_NAME`: a **unique, active, visible** exercise name
  available to the staging athlete. Do not use a real person's records.
- `MOBILE_STAGING_ANDROID_APP_ID`: the verified staging APK application ID,
  which must be different from your production application ID. The workflow
  checks it against the operator-supplied `app_id` before downloading the APK.
- Keep the existing `MOBILE_E2E_EMAIL` and `MOBILE_E2E_PASSWORD` bound to a
  disposable **ATHLETE** account; preserve environment approval and the
  `main`-branch restriction.

Build the reviewed **preview** APK from `main`, independently confirm its
SHA-256 and embedded HTTPS **staging** backend, and select `workout-write`
in the manual workflow. The test names workouts
`Mobile-smoke-<run-id>-<run-attempt>` for traceability. It writes to the
staging database. Remove its disposable test records after the run.

A green normal CI means that code contracts and static selectors pass; it
**does not prove** the Maestro scenario executed on an emulator. If the
actual staging smoke fails, promotion remains **NO-GO** until reviewed.

## Manual device-level workout reconciliation acceptance (#324)

**This is a separate optional gate, not ordinary PR CI or an automatic release
approval.** The platform-specific Maestro flows below target a **real approved
staging-native build** on Android or iOS. A green Vitest/Metro build only checks
code and flow contracts; it never means an emulator/iPhone completed a test.

### Prepare isolated staging fixtures (required)

- Use the reviewed `main` commit, approved Expo EAS **preview** environment
  with an owned app identifier and **HTTPS staging-only** API origin. Confirm
  that it does not route to production. Never add personal/production data.
- Use a disposable staging **ATHLETE** (`MOBILE_E2E_EMAIL`,
  `MOBILE_E2E_PASSWORD`) and seed a **unique, single-set `IN_PROGRESS` workout**
  with a unique `E2E_WORKOUT_TITLE` and usable positive planned reps and
  weight. The set must be `PENDING`; ensure it is visible in the athlete's
  workout list and has **no other sets**. Reset to `PENDING` (or seed a new
  uniquely named workout) _before each scenario_. Never reuse already-completed
  records for the following test. Record the specific workout/set IDs in the
  **private staging evidence**, not in public CI output.
- For Android GitHub Actions, set `MOBILE_E2E_RECONCILE_WORKOUT_TITLE` in the
  protected `mobile-staging` environment and select one of
  `reconcile-resume`, `reconcile-offline-android` or `reconcile-lost-response`.
  The workflow enforces the configured staging Android app ID, trusted
  APK URL, independent SHA-256 and APK manifest check before installation.
  Existing normal `workout-write` still creates its own uniquely named record.

### Scenarios and expected results

| Flow                                     | Platforms                                         | Expected result                                                                                                                                                           | Mutation evidence                                  |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `workout-reconcile-resume.yaml`          | Android + iOS                                     | Confirm one set, background/foreground (without killing the app), then terminate/relaunch; the completed server state persists                                            | Exactly **one** PATCH for the selected set         |
| `workout-reconcile-offline-android.yaml` | **Android only**                                  | Enable airplane mode **before** pressing save: the preflight refuses sending; after connectivity returns and app reopens the set is still PENDING                         | **Zero** PATCH calls during the offline step       |
| `workout-reconcile-lost-response.yaml`   | Android + iOS, **staging fault fixture required** | A server-committed PATCH has its HTTP response dropped exactly once. GET revalidation shows “Стан отримано із сервера” and “✓ Збережено” before and after resume/relaunch | Exactly **one** committed PATCH; no implicit retry |

**What interrupted PATCH means here:** the `lost-response` scenario tests a
network interruption **after the staging server has accepted and committed the
PATCH**, so the client cannot rely on its transport result. The Android
`offline` scenario separately tests the _definite pre-send_ failure. They
must not be confused: disabling all networking before the request does **not**
simulate a lost response after a successful write.

The lost-response flow is **fail-closed without a real fault injector**:
a normal successful PATCH cannot show its required unknown-result/revalidation
message and the Maestro assertion will fail. **No test-only fault endpoint or
switch is embedded into the mobile binary.** The staging operator must
provide an independently controlled, one-shot fault at the network edge that
forwards exactly the selected PATCH (for that account, workout and set) to
staging, observes the upstream commit, and drops **only its response** before
it reaches the device. The subsequent GET must be available and return the
canonical state. Record backend request counts and confirm production was
never contacted. Merely seeing the UI assertion succeed is **not enough** to
prove exactly one PATCH; request log evidence is mandatory. Do not run this
fixture on any shared or production gateway, or with broad wildcard matching.

### Execute on Android (GitHub protected staging environment)

From the reviewed `main` branch, manually start **Mobile native E2E / Maestro
(manual)**. Give the EAS preview APK URL and independent checksum, the
**approved staging** `app_id`, and the selected flow name. Before
`reconcile-lost-response`, arm the staging-only fault fixture and verify the
unique seeded PENDING set. The workflow still runs only on an **Android
emulator**. It will **not** run automatically when a PR is opened or merged.

After every run, independently inspect staging API audit records for the
specific workout and set: assert exact PATCH count (0/1 as above), the final
canonical status and no production access. If the fault injector was not
armed or evidence cannot be obtained, mark the result **NO-GO** and rerun
with a fresh fixture. Reset/remove test data afterward.

### Execute on iOS (Mac + approved simulator or physical device)

This repository does **not** currently define or provision a verified EAS
iOS simulator `.app` / signed iPhone build or an iOS native GitHub Actions
runner. The owner must first configure an **owned staging iOS bundle ID**,
reviewed preview build profile/signing and a staging HTTPS API, then install
the resulting approved build on the selected device. **Expo Go is not a
substitute** for the actual staging-native build. Do not invent signing IDs.

On an authorized Mac with Xcode, Maestro **2.12.1**, and the approved build
installed, run the same cross-platform flow against the real staging bundle ID:

```sh
# Run locally on the trusted Mac only; do not paste credentials into public logs.
maestro test \
  -e APP_ID="$STAGING_IOS_BUNDLE_ID" \
  -e E2E_EMAIL="$STAGING_E2E_EMAIL" \
  -e E2E_PASSWORD="$STAGING_E2E_PASSWORD" \
  -e E2E_WORKOUT_TITLE="$STAGING_SEEDED_WORKOUT_TITLE" \
  apps/mobile/maestro/flows/workout-reconcile-resume.yaml
# After re-seeding and arming the isolated commit-then-drop fixture:
# Repeat with apps/mobile/maestro/flows/workout-reconcile-lost-response.yaml
```

These flows use `pressKey: home` followed by `launchApp: stopApp: false` for
real background/foreground reactivation; `stopApp` followed by a cold
`launchApp` separately checks session/server persistence. **Do not run
`workout-reconcile-offline-android.yaml` on iOS**: Maestro's airplane-mode
command has no effect on iOS simulators. iOS offline/unknown-result behavior
requires a controlled staging network fault and operator evidence, not an
unverified `simctl status_bar` cosmetic change.

### Evidence and promotion

For each platform and scenario record privately: build SHA/commit, EAS project
owner, app ID, verified API origin, device/OS, run timestamp, fixture IDs,
fault mode/start time, **server-side PATCH count**, final GET status, whether
a native process was restarted, and Maestro pass/fail. Never publish
credentials, full user-bearing screenshots, tokens or raw backend traces as
public CI artifacts.

**Acceptance is NO-GO** until both platform runs are actually performed,
read-only reconciliation and exact write-count are confirmed, and failed
runs are addressed. This PR only adds runnable flows, guarded dispatch and
static contract tests; **Issue #324 stays open** until operator-supplied
native evidence passes.
