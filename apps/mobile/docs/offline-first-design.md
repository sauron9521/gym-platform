# Offline-first workout draft boundary

Status: **contract foundation, not a shipped offline-first feature**.

This PR specifies the typed, account-scoped draft payload that a future local
storage adapter can use. It intentionally does not install AsyncStorage/SQLite,
persist PHI to a device, queue network mutations, or automatically sync anything.

To deliver offline-first safely:
1. Add an Expo-compatible local storage adapter (prefer an encrypted-at-rest
   solution if sensitive training data must persist); update the pnpm lockfile.
2. Persist by verified account ID and erase local private drafts on logout,
   account switch, or data-deletion requests.
3. Provide explicit conflict review, last-known server state and consent
   before replaying edits, with stable idempotency keys for every write.
4. Test process death/restart, token rotation, network restoration, failed writes,
   multiple devices, and stale server versions on real Android and iOS builds.

No automatic replay is safe until the server contract supports it explicitly.
