# Push notification safety policy

Status: **foundation only; no device push is enabled by this PR**.

- Default user settings are all opt-out.
- Request native permission only after an explicit user action and explain the
  notification category in the UI.
- Register an Expo device token only for a verified signed-in user; revoke or
  unlink the token on logout, account switch and data deletion.
- The server must authorize token ownership, sign notifications and store
  categories/preferences. Keep message content out of payloads; fetch by
  opaque notification ID after authenticating the app.
- Add `expo-notifications` only with Expo-version matching install commands,
  updated pnpm lockfile, EAS push credentials and native test builds.
- Never automatically enable push in a PR that lacks a real staging backend.

The code defines validation and consent rules; actual push delivery, scheduling,
backend registration and preference UI are separate implementation steps.
