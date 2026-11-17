/** A missing connectivity signal is unknown, not proof of being offline. */
export function isConnectionAvailable(state: {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}
