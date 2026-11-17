# Landing accessibility guardrails

- Header navigation is available without authentication and uses a native details disclosure on small screens.
- Press Escape to close the mobile menu and restore keyboard focus to its trigger.
- Choosing a menu link closes the disclosure; primary content must be reachable with the skip link.
- Keep exactly one H1 per route, semantic sections, visible focus styles and meaningful link labels.
- Verify at 320/390/768/1280 px and with reduced motion; do not depend on motion to convey state.
- E2E smoke tests cover mobile keyboard navigation, while component tests cover section headings and links.
