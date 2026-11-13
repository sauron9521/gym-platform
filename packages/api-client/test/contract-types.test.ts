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

export type AuthContractChecks = [HasSessionLogin, HasTokenIssue, HasTokenRefresh, HasCurrentUser];

const browser = createBrowserSessionClient({ baseUrl: 'https://api.example.test' });
void browser.GET('/users/me');
void browser.POST('/auth/login', {
  body: { email: 'athlete@example.test', password: 'CorrectPassword123!' },
});
// @ts-expect-error - auth login requires a password
void browser.POST('/auth/login', { body: { email: 'athlete@example.test' } });

const native = createBearerTokenClient({
  baseUrl: 'https://api.example.test',
  getAccessToken: async () => null,
});
void native.GET('/users/me');
void native.POST('/auth/token', {
  body: { email: 'athlete@example.test', password: 'CorrectPassword123!' },
});
void native.POST('/auth/token/refresh', { body: { refreshToken: 'new-token-value' } });
// @ts-expect-error - refresh token is mandatory
void native.POST('/auth/token/refresh', { body: {} });

type LoginResponse =
  operations['AuthController_signIn']['responses'][200]['content']['application/json'];
type TokenResponse =
  operations['TokensController_issue']['responses'][200]['content']['application/json'];
type RotatedTokenResponse =
  operations['TokensController_refresh']['responses'][200]['content']['application/json'];

const sessionState: LoginResponse = { mfaRequired: false };
const tokenPair: TokenResponse = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 900,
};
const rotated: RotatedTokenResponse = tokenPair;
void sessionState;
void rotated;
// @ts-expect-error - login response must include the MFA flag
const missingMfa: LoginResponse = {};
void missingMfa;

// @ts-expect-error - the mobile factory requires an explicit access-token callback
createBearerTokenClient({ baseUrl: 'https://api.example.test' });
