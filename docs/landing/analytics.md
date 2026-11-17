# Landing analytics — optional integration

The Landing loads **no third-party analytics script by default**. An operator
explicitly enables the integration at build time by providing both:

- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`: an Umami website UUID.
- `NEXT_PUBLIC_UMAMI_SCRIPT_URL`: an audited, trusted `https://` provider URL
  ending in `.js` with no URL credentials, query or fragment.

Invalid or missing settings fail closed. The script uses Next.js
`afterInteractive`, meaning it can load after the page begins hydration,
**not** after the visitor clicks or provides consent.

Only these fixed custom event names are sent on tracked CTA/card clicks:
`landing_primary_cta`, `landing_secondary_cta`, `landing_feature_card`.
No form fields, email addresses, account IDs or workout data are attached to
custom events. The provider itself may still receive page URLs, IP addresses,
user-agent data and page-view events. "Cookieless" does not guarantee
anonymity or legal compliance.

Before production enablement, review provider access, hosting,
data retention, page-view settings, consent/opt-out requirements, privacy
notices, CSP allowances and applicable law. Never enable analytics in PR
previews by default or track private app pages through Landing.

Both public environment variables are already included in Turborepo build
cache hashing (merged PR #190). Changing the variables requires a fresh
production build and a verification of actual outgoing requests.
