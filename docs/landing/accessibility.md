# Landing accessibility guardrails

- Header navigation is available without authentication and uses a native details disclosure on small screens.
- Press Escape to close the mobile menu and restore keyboard focus to its trigger.
- Choosing a menu link closes the disclosure; primary content must be reachable with the skip link.
- Keep exactly one H1 per route, semantic sections, visible focus styles and meaningful link labels.
- Verify at 320/390/768/1280 px and with reduced motion; do not depend on motion to convey state.
- E2E smoke tests cover mobile keyboard navigation, while component tests cover section headings and links.

## Keyboard focus and touch target smoke (Issue #389)

`apps/landing/e2e/landing-cta-accessibility.spec.ts` verifies the public
Athlete/Coach hero CTA and footer navigation in Chromium at 320px (Light)
and 1280px (Dark): semantic link names, internal destinations, a minimum
44px action height, keyboard Tab/Enter navigation, and the footer's
visible keyboard focus outline. These checks run in the existing affected
Landing E2E job; do not add screenshot-only gates or dependencies.

This is **browser smoke, not a full WCAG or product-release signoff**.
Before public launch, manually check Safari/iOS VoiceOver, Android/TalkBack,
keyboard-only navigation at 320/390/768/1280px, zoom/large text, Light/Dark
contrast and reduced motion. Compare screen captures to the approved OVRANTO
reference, record discrepancies under #389, and verify actual deployment
and public CTA destinations under #393. Keep non-launched products labeled
as in development and do not change product links to unverified hosts.
