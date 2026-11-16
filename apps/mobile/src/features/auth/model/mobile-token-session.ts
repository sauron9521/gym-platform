/** Single-use refresh tokens are rotated, never refreshed concurrently. */
export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type RefreshTokenStore = {
  read: () => Promise<string | null>;
  write: (refreshToken: string) => Promise<void>;
  remove: () => Promise<void>;
};

type Refresh = (refreshToken: string) => Promise<IssuedTokens | null>;
type Revoke = (refreshToken: string) => Promise<void>;

const REFRESH_LEEWAY_MS = 30_000;

export class MobileTokenSession {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt = 0;
  private generation = 0;
  private storageQueue: Promise<void> = Promise.resolve();
  private restorePromise: Promise<boolean> | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  private readonly store: RefreshTokenStore;
  private readonly refreshRequest: Refresh;
  private readonly revokeRequest: Revoke;
  private readonly onInvalidated: () => void;
  private readonly now: () => number;

  constructor(
    store: RefreshTokenStore,
    refreshRequest: Refresh,
    revokeRequest: Revoke,
    onInvalidated: () => void,
    now: () => number = Date.now,
  ) {
    this.store = store;
    this.refreshRequest = refreshRequest;
    this.revokeRequest = revokeRequest;
    this.onInvalidated = onInvalidated;
    this.now = now;
  }

  get revision() {
    return this.generation;
  }

  get currentRefreshToken() {
    return this.refreshToken;
  }

  /** Re-verify a freshly rotated access token without replaying a refresh token. */
  canRevalidate(): boolean {
    return this.accessToken !== null && this.now() < this.expiresAt - REFRESH_LEEWAY_MS;
  }

  private enqueueStorage(operation: () => Promise<void>): Promise<void> {
    const next = this.storageQueue.then(operation, operation);
    this.storageQueue = next.catch(() => undefined);
    return next;
  }

  private apply(tokens: IssuedTokens) {
    if (
      !tokens.accessToken ||
      !tokens.refreshToken ||
      !Number.isFinite(tokens.expiresIn) ||
      tokens.expiresIn <= 0
    ) {
      throw new Error('Invalid token response');
    }
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.expiresAt = this.now() + tokens.expiresIn * 1000;
  }

  /** Persist the refresh token BEFORE exposing its access token to the app. */
  async accept(tokens: IssuedTokens): Promise<boolean> {
    const revision = ++this.generation;
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    await this.enqueueStorage(async () => {
      if (this.generation === revision) await this.store.write(tokens.refreshToken);
    });
    if (this.generation !== revision) return false;
    this.apply(tokens);
    return true;
  }

  /** Restore once even if React Strict Mode mounts the provider twice. */
  restore(): Promise<boolean> {
    if (this.restorePromise) return this.restorePromise;
    const revision = this.generation;
    this.restorePromise = (async () => {
      const saved = await this.store.read();
      if (!saved || this.generation !== revision) return false;
      this.refreshToken = saved;
      return this.rotate(true);
    })();
    return this.restorePromise;
  }

  async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.now() < this.expiresAt - REFRESH_LEEWAY_MS) {
      return this.accessToken;
    }
    if (!this.refreshToken) return null;
    return (await this.rotate()) ? this.accessToken : null;
  }

  async rotate(force = false): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    if (!this.refreshToken) return false;
    if (!force && this.accessToken && this.now() < this.expiresAt - REFRESH_LEEWAY_MS) {
      return true;
    }

    const revision = this.generation;
    const spentToken = this.refreshToken;
    const operation = (async () => {
      // Network failures propagate without deleting a possibly still-valid credential.
      // The server consumes a refresh token once; never automatically retry a request.
      const next = await this.refreshRequest(spentToken);
      if (this.generation !== revision) {
        if (next) await this.revokeRequest(next.refreshToken).catch(() => undefined);
        return false;
      }
      if (!next) {
        await this.clear();
        this.onInvalidated();
        return false;
      }

      try {
        await this.enqueueStorage(async () => {
          if (this.generation === revision) await this.store.write(next.refreshToken);
        });
        if (this.generation !== revision) {
          await this.revokeRequest(next.refreshToken).catch(() => undefined);
          return false;
        }
        this.apply(next);
        return true;
      } catch {
        // A rotated token that cannot be persisted must never leave a usable
        // session in memory; revoke its successor on a best-effort basis.
        await this.clear().catch(() => undefined);
        this.onInvalidated();
        await this.revokeRequest(next.refreshToken).catch(() => undefined);
        return false;
      }
    })();

    this.refreshPromise = operation;
    try {
      return await operation;
    } finally {
      if (this.refreshPromise === operation) this.refreshPromise = null;
    }
  }

  /** Invalidate memory immediately; serialized deletion wins over pending writes. */
  async clear(): Promise<void> {
    ++this.generation;
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    await this.enqueueStorage(() => this.store.remove());
  }
}
