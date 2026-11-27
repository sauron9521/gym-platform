import type { paths, operations } from '../src/generated/schema.js';
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

// Shared account-scoped notification settings are accessible to both transports.
void browser.GET('/users/me/notification-settings');
void native.GET('/users/me/notification-settings');
void native.PATCH('/users/me/notification-settings', {
  body: {
    reminderLeadMinutes: 15,
    preferences: [{ category: 'WORKOUT', channel: 'LOCAL_REMINDER', enabled: true }],
  },
});
// @ts-expect-error - unsupported lead time
void browser.PATCH('/users/me/notification-settings', { body: { reminderLeadMinutes: 30 } });
type NotificationPatch =
  paths['/users/me/notification-settings']['patch']['requestBody']['content']['application/json'];
type Preference = NonNullable<NotificationPatch['preferences']>[number];
// @ts-expect-error - no unsupported channel pairs
const wrongPair: Preference = { category: 'WORKOUT', channel: 'EMAIL', enabled: true };
// @ts-expect-error - timezone is read-only in this resource
const wrongTimezone: NotificationPatch = { timezone: 'UTC' };
void wrongPair;
void wrongTimezone;

// The shared Inbox contract exposes only the authenticated account projection.
void browser.GET('/notifications', { params: { query: { limit: '20', unread: 'true' } } });
void native.GET('/notifications/unread-count');
void native.GET('/notifications/{id}', { params: { path: { id: 'notification-id' } } });
void browser.PATCH('/notifications/{id}/read', { params: { path: { id: 'notification-id' } } });
void native.POST('/notifications/read-all');
// @ts-expect-error - recipient selection is server-owned
void native.GET('/notifications', { params: { query: { recipientId: 'other' } } });
// @ts-expect-error - ADMIN scope is not a client-selectable category
void browser.GET('/notifications', { params: { query: { category: 'ADMIN' } } });

type InboxItem =
  paths['/notifications/{id}']['get']['responses'][200]['content']['application/json'];
const programTarget: NonNullable<InboxItem['target']> = {
  kind: 'PROGRAM_ASSIGNMENT',
  id: 'assignment-id',
};
// @ts-expect-error - arbitrary links are not a valid target
const unsafeTarget: NonNullable<InboxItem['target']> = { kind: 'URL', id: 'https://example.test' };
const programType: InboxItem['type'] = 'program.assignment.completed';
const relationTarget: NonNullable<InboxItem['target']> = {
  kind: 'TRAINER_RELATIONSHIP',
  id: 'relation-id',
};
void browser.GET('/notifications', {
  params: { header: { 'x-inbox-audience': 'trainer', 'x-inbox-owner': 'owner-id' } },
});
// @ts-expect-error - client cannot request an ADMIN audience
void browser.GET('/notifications', { params: { header: { 'x-inbox-audience': 'admin' } } });
void relationTarget;
void programTarget;
void unsafeTarget;
void programType;
