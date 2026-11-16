# Mobile native staging smoke (EAS + Maestro)

This workflow is **manual**. GitHub CI's iOS JavaScript export does not
run an iOS simulator or Android APK.

1. Connect the Expo project using `eas init` from `apps/mobile`. Configure
   the real iOS bundle identifier and Android application ID before building;
   do not invent an Expo project UUID or signing credentials.
2. Build an APK against a **HTTPS** staging API (mobile release builds
   refuse cleartext HTTP), with EAS Android `preview` profile:
   `eas build --profile preview --platform android`.
3. Set GitHub environment **mobile-staging** with secrets
   `MOBILE_E2E_EMAIL` and `MOBILE_E2E_PASSWORD` for a **disposable** staging user.
4. Run GitHub Actions **Mobile native E2E / Maestro (manual)** from `main`.
   Enter the EAS preview APK download URL, its actual Android application ID,
   and one of `auth`, `workouts` or `session-restore`.
5. Inspect emulator logs and Maestro output. Any failure is a NO-GO for
   promoting the native build. Never run these flows against production user data.

The session-restore flow verifies that SecureStore survives an app restart,
that protected routes stay signed in, and that explicit logout removes the session.
The workflow deliberately does **not** run on every push, require Expo cloud
secrets for normal CI, or automatically publish to stores.
