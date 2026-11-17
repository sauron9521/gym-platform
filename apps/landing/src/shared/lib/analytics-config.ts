/** The script URL is operator-controlled, never a user-provided string. */
export function getAnalyticsScriptConfig(
  websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
  scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
): { websiteId: string; src: string } | null {
  if (
    !websiteId ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(websiteId) ||
    !scriptUrl
  ) {
    return null;
  }

  try {
    const url = new URL(scriptUrl);
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      !url.pathname.endsWith('.js')
    ) {
      return null;
    }

    return { websiteId, src: url.toString() };
  } catch {
    return null;
  }
}
