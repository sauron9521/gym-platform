import type { paths } from '../src/generated/schema.js';
import { createGymApiClient } from '../src/index.js';

type Assert<T extends true> = T;
type HasHealthEndpoint = Assert<'/health/live' extends keyof paths ? true : false>;
export type CompileTimeHealthCheck = HasHealthEndpoint;

const api = createGymApiClient({ baseUrl: 'http://localhost:3001' });
void api.GET('/health/live');
// @ts-expect-error - a misspelled route is not present in the generated contract
void api.GET('/health/not-a-real-route');

import { createBearerTokenClient, createBrowserSessionClient } from '../src/index.js';

type HasSessionLogin = Assert<'/auth/login' extends keyof paths ? true : false>;
type HasTokenIssue = Assert<'/auth/token' extends keyof paths ? true : false>;
type HasTokenRefresh = Assert<'/auth/token/refresh' extends keyof paths ? true : false>;
type HasCurrentUser = Assert<'/users/me' extends keyof paths ? true : false>;

export type AuthContractChecks = [
  HasSessionLogin,
  HasTokenIssue,
  HasTokenRefresh,
  HasCurrentUser,
];

const browser = createBrowserSessionClient({ baseUrl: 'https://api.example.test' });
void browser.POST('/auth/login', { body: { email: 'user@example.test', password: 'secret' } });

const native = createBearerTokenClient({
  baseUrl: 'https://api.example.test',
  getAccessToken: async () => null,
});
void native.GET('/users/me');

// @ts-expect-error - the mobile factory requires an explicit access-token callback
createBearerTokenClient({ baseUrl: 'https://api.example.test' });
