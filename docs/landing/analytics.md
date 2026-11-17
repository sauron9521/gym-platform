# Landing analytics — opt-in

The Landing renders **no analytics script by default**.

To enable an Umami-compatible provider, set both:
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`: website UUID
- `NEXT_PUBLIC_UMAMI_SCRIPT_URL`: trusted HTTPS URL to the provider script

The script is added after interaction and only known event names are sent:
`landing_primary_cta`, `landing_secondary_cta`, `landing_feature_card`.
No names, emails, credentials, workout data, search terms or URLs are included in events.

This is an integration point, **not** a hosted analytics backend or consent/compliance guarantee.
Before enabling in production, verify the host, retention, opt-out and privacy notices for
the audience and applicable rules. Do not track private application activity from Landing.

Analytics public environment values must be tracked by build-cache key configuration
before deployment, and should not be enabled in pull-request previews by default.
