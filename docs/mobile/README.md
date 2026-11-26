# Mobile documentation

Start with the [current Expo application README](../../apps/mobile/README.md). JavaScript tests and exports do not replace signed-device and staging verification.

- [Native testing foundation](native-testing.md)
- [Offline workout draft safety proposal](offline-workout-drafts.md)
- [Native staging smoke](../../apps/mobile/docs/native-staging-smoke.md)
- [Release channels](../../apps/mobile/docs/release-channels.md)
- [Offline-first design](../../apps/mobile/docs/offline-first-design.md)
- [Push notification design](../../apps/mobile/docs/push-notification-design.md)

Design and preparatory contracts are not implementation claims. See [Beta evidence gates](../beta-readiness-gates.md) and [Security](../security/README.md) for independent acceptance.

## Active workout exercise disclosure

The optional device/account-scoped auto-collapse-exercises preference defaults
off. Only nonempty exercise groups with every set completed or skipped in an
active own workout collapse, after confirmed server state and no pending write
for that exercise or unresolved reconciliation. The header keeps completed/
skipped counts visible. Manual reopening remains sticky until that exercise
becomes pending again or the preference is disabled. Existing rows remain
mounted but hidden from accessibility while collapsed. This preserves drafts
and does not change workout completion rules, rest timer or API writes.
No server preference or cross-device synchronization is introduced.
