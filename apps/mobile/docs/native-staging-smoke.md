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

### Foreground authentication regression coverage

The JavaScript component regression suite `test/vitest/auth-foreground.test.tsx`
checks that backgrounding clears account/workout queries; foreground grant
verification restores only the current account snapshot (marked stale), and a
superseded check, logout or failed verification cannot repopulate private cache.
The suite mocks AppState and API transport: it does not substitute for Android
or iOS execution. On the native resume scenario, also confirm a canonical GET
after foreground verification and that no additional PATCH is sent. Do not
close #324 or #348 until the device/build evidence above exists.

## M10.5 — Offline draft native acceptance (#345)

These three scenarios exercise the real native SQLCipher build and the existing
reviewed submission UI. They are **manual, staging-only** runs. Normal PR CI
checks contracts, not native execution. Neither Expo Go nor a Metro bundle
can satisfy this gate.

### Setup

- Complete the Android/iOS preflight and trusted-build setup above. Use a
  newly rebuilt approved staging-native binary with SQLCipher enabled, the
  actual reviewed commit, and the isolated HTTPS staging API. Confirm the app
  ID is not the production ID. No release identifier or signing key is invented
  by this PR.
- Use fresh disposable verified athlete accounts with Ukrainian locale and
  one unique, active, visible exercise with an ASCII name. The accounts must
  have no pre-existing local draft; never clear a real user's app data.
  On iOS, app data clearing does not necessarily clear Keychain; use a fresh
  simulator or explicitly verified clean disposable staging installation.
- Use the existing protected `mobile-staging` environment, main-only
  deployment restrictions, required reviewers, verified EAS APK URL,
  independent SHA-256 and `MOBILE_STAGING_ANDROID_APP_ID`.
  For all three flows set `MOBILE_E2E_EXERCISE_NAME`, and the existing
  `MOBILE_E2E_EMAIL` / `MOBILE_E2E_PASSWORD`.
  For `draft-account-isolation` only, add distinct disposable athlete
  credentials `MOBILE_E2E_SECOND_EMAIL` / `MOBILE_E2E_SECOND_PASSWORD`.
  The workflow rejects empty credentials and equal email addresses before
  downloading the APK. Independently verify distinct server account IDs.
- Use a unique title for each run. Normal dispatch generates a run-based
  title. For `draft-lost-response`, enter a unique
  `draft_fault_title` matching `Mobile-draft-fault-<8–64 ASCII letters/digits/hyphens>`
  and pre-arm the matching one-shot staging fixture **before dispatch**.

### Runnable Maestro flows and evidence

| Dispatch / file                                                    | Expected native UI result                                                                                                                                        | Independent staging evidence                                                                                                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft-resume` / `workout-draft-resume.yaml`                       | Local save, background, cold restart, explicit restore and send, persisted acknowledgment after another cold restart, local cleanup and empty slot after restart | Zero POST before confirmation; exactly one POST /workouts and one created workout; no extra POST after acknowledgment/cleanup                                           |
| `draft-lost-response` / `workout-draft-lost-response.yaml`         | Pending state after fault; no discard; restart; no automatic send; explicit restore/review/retry; receipt and cleanup                                            | Exactly two POST requests, same authenticated athlete, idempotency key and canonical request body; first committed response dropped; exactly one resulting workout UUID |
| `draft-account-isolation` / `workout-draft-account-isolation.yaml` | A saves locally; explicit logout; B signs in and sees no draft; A signs in again and sees no draft                                                               | Zero POST /workouts; independently verify A and B IDs differ, no previous owner data and local cleanup                                                                  |

The lost-response scenario needs a controlled **staging-only** fault injector
that matches the exact disposable athlete and unique title, forwards the first
POST /workouts, observes successful commit, and drops only that response.
The second request must reach the real staging backend normally. The operator
must independently inspect the request count, idempotency key equality,
canonical body equality and single persisted workout. Record equality and
counts, not the raw key or payload, in evidence. A normal successful 201
cannot pass the required pending-state assertion. Airplane mode before POST
is not a substitute for this post-commit fault. Do not add a production
fault endpoint or embed a debug switch into the app.

For Android dispatch the existing `Mobile native E2E / Maestro (manual)`
workflow from reviewed main with the approved APK and flow choice. For iOS,
use an approved native simulator/device build on an authorized Mac, Maestro
2.12.1, the same environment variables and the flow file. The workflow is
Android-only; iOS runs are manual. Example for a disposable iOS simulator:

```sh
maestro test \
  -e APP_ID="$STAGING_IOS_BUNDLE_ID" \
  -e E2E_EMAIL="$STAGING_E2E_EMAIL" \
  -e E2E_PASSWORD="$STAGING_E2E_PASSWORD" \
  -e E2E_EXERCISE_NAME="$STAGING_EXERCISE_NAME" \
  -e E2E_WORKOUT_TITLE="$STAGING_UNIQUE_TITLE" \
  apps/mobile/maestro/flows/workout-draft-resume.yaml
```

Use the second-account variables only for isolation and a separately
pre-armed unique title for the fault test. Never paste credentials into
shared terminals/logs or upload screenshots containing identities.

### Additional manual native security and offline checks

A passing Maestro UI is not proof of encryption or secure storage. On
**both platforms** complete the following separately, using only synthetic
data on an authorized staging inspection build/device. A non-debuggable APK
may prohibit sandbox inspection; use an explicitly approved debuggable
staging variant with the same SQLCipher config and code, and document the
difference from the preview artifact. Do not weaken production settings.

| Check                                | Evidence required                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cipher availability and at-rest file | Confirm nonempty native `PRAGMA cipher_version` via an approved local inspection/test harness, save a unique synthetic marker, stop the app, inspect the actual private `ovranto-offline-draft-v1.db` and existing journal/WAL/SHM. Normal SQLite must not read the schema without the key and the unique synthetic plaintext must not appear. Header inspection alone is not proof. Never extract or log a real key or token. |
| Wrong key / key loss / corruption    | On a disposable sandbox copy/test harness only, use a deliberately wrong test key and corrupted ciphertext or simulate loss of the key marker; expect fail-closed storage and no silent recreation or plaintext fallback. Do not mutate the real device's credentials.                                                                                                                                                         |
| Offline save and reconnect           | While the verified athlete remains foreground, fill a valid form, disable network using actual device controls, save locally, verify the offline indication and no send action. Restore network without tapping send: zero POST. Explicit review/confirmation creates at most one workout. Repeat with a background/resume: current auth policy requires online re-verification before restoring private data.                 |
| Interrupted cleanup                  | With a synthetic confirmed receipt, induce a local file-removal failure through an authorized native test harness; verify only cleanup retry is offered, kill/reopen, verify durable purge intent is reconciled before new access. No second POST. Do not inject faults into production builds.                                                                                                                                |
| Device lock / backups / reinstall    | Verify locked-device key access, Android backup/data-extraction rules and iOS backup exclusion for DB/sidecars, restore/reinstall behavior, and no cross-account recovery or plaintext data. Record actual OS/build behavior; verify SecureStore/Keychain lifecycle, not only the UI.                                                                                                                                          |

Do not copy entire private databases or key material into public artifacts.
If the required inspection harness, platform or staging fault fixture is
unavailable, record **NOT RUN / NO-GO**, not PASS. The above checks do not
promise forensic erasure on flash storage.

### Evidence record (private staging only)

Record per platform/scenario: reviewed commit, build SHA, app ID, verified
staging origin, OS/device, fixture title and anonymized account identifiers,
run ID/time, actual process restart, request counts, same-key/body check
(where applicable), created-workout count, cleanup/inspection result, and
PASS/FAIL/NOT RUN. Mark manual security checks independently; remove
disposable server fixtures after evidence is recorded.

**M10.5 status: prepared, NOT RUN.** Issue #345 remains open until Android
and iOS acceptance, encryption/key lifecycle, backup/restore and fault/cleanup
evidence pass. Missing app identifiers, approved EAS builds, staging
credentials, native tooling and an isolated fault fixture are operator
dependencies. These flow contracts do not authorize production release.

## M11 — Workout Calendar native acceptance (#340)

The `calendar-read` manual workflow / `workout-calendar-smoke.yaml` scenario
uses the existing protected staging environment, verified APK hash and
approved staging package. It is **read-only for workouts**. Set
`MOBILE_E2E_CALENDAR_WORKOUT_TITLE` to a unique synthetic workout owned by
the disposable verified Ukrainian-locale athlete. Seed it for **today in
the target device's local timezone**, away from midnight, with at least one
exercise. Ensure the same title is absent from other workouts. Do not reuse
a stale fixture after the local date changes. The workflow rejects a missing
title or a mismatched staging app ID before downloading the APK.

The scenario opens the monthly calendar, selects Today, finds the seeded
workout, switches to Week, verifies the weekly agenda, navigates to the
previous week, returns to Today and opens the actual workout details.
The previous-week UI assertion is a smoke check, not independent proof
of completeness. Verify both query bounds and returned fixture IDs with
private staging evidence. On iOS run the same flow locally against an
approved native build using Maestro 2.12.1 and `APP_ID`, `E2E_EMAIL`,
`E2E_PASSWORD`, `E2E_WORKOUT_TITLE` as above.

Additional acceptance on both platforms: verify week crossing month/year
boundaries with workouts on both sides, local time around DST and midnight,
all status markers, ordering, empty week/month, network error and recovery,
no partial results on failed pagination, large-text/screen-reader navigation,
light/dark themes and account switch isolation. Verify **zero workout POST,
PATCH or DELETE** calls for the read-only journey. Use only disposable staging
records and retain private build/device/fixture/request-count evidence.
Do not expose tokens, credentials or user-bearing screenshots.

Status: **prepared, NOT RUN**. Actual Android/iOS device runs remain necessary
for #340; normal contract and component CI do not prove native acceptance.
