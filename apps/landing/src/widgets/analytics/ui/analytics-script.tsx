import Script from 'next/script';

/**
 * Opt-in, cookieless-compatible provider script. Without both environment
 * settings no third-party network request is initiated by this component.
 */
export function AnalyticsScript() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const configured = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;

  if (
    !websiteId ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(websiteId) ||
    !configured
  ) {
    return null;
  }

  let src: string;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      return null;
    }
    src = url.toString();
  } catch {
    return null;
  }

  return <Script src={src} data-website-id={websiteId} strategy="afterInteractive" />;
}
