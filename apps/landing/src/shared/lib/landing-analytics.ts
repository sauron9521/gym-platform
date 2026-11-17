export type LandingEventName =
  'landing_primary_cta' | 'landing_secondary_cta' | 'landing_feature_card';

declare global {
  interface Window {
    umami?: { track: (event: string) => void };
  }
}

/** Event names only: never send personal identifiers, workout logs or form data. */
export function recordLandingEvent(name: LandingEventName) {
  if (typeof window !== 'undefined' && typeof window.umami?.track === 'function') {
    try {
      window.umami.track(name);
    } catch {
      // A third-party provider failure must not interfere with site navigation.
    }
  }
}
