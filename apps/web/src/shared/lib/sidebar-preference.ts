/** Host-only visual preference; read by the protected layout during SSR. */
export const SIDEBAR_COOKIE_NAME = 'ovranto-sidebar';
export const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === 'collapsed';
}
