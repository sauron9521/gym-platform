import Script from 'next/script';

import { getAnalyticsScriptConfig } from '@/shared/lib/analytics-config';

/** No analytics script is loaded unless both public settings are valid. */
export function AnalyticsScript() {
  const config = getAnalyticsScriptConfig();

  if (!config) return null;

  return <Script src={config.src} data-website-id={config.websiteId} strategy="afterInteractive" />;
}
