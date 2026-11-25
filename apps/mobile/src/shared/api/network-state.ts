/** A missing connectivity signal is unknown, not proof of being offline. */
export function isConnectionAvailable(state: {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

type ConnectionState = Parameters<typeof isConnectionAvailable>[0];

/** Live events take precedence over the initial asynchronous snapshot. */
export function subscribeToConnectionState(
  read: () => Promise<ConnectionState>,
  subscribe: (listener: (state: ConnectionState) => void) => { remove(): void },
  setOnline: (online: boolean) => void,
): () => void {
  let active = true;
  let receivedEvent = false;
  const subscription = subscribe((state) => {
    if (!active) return;
    receivedEvent = true;
    setOnline(isConnectionAvailable(state));
  });

  void read()
    .then((state) => {
      if (active && !receivedEvent) setOnline(isConnectionAvailable(state));
    })
    .catch(() => undefined);

  return () => {
    active = false;
    subscription.remove();
  };
}
