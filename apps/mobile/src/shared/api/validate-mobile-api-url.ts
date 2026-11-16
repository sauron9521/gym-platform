/** Prevent sending bearer credentials over cleartext transport in native release builds. */
export function validateMobileApiBaseUrl(baseUrl: string, production: boolean): string {
  const url = new URL(baseUrl);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Mobile API URL must be an HTTP(S) endpoint without credentials');
  }
  if (production && url.protocol !== 'https:') {
    throw new Error('Mobile release builds require HTTPS for API tokens');
  }
  return baseUrl;
}
