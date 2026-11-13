import type { paths } from '../src/generated/schema.js';
import { createGymApiClient } from '../src/index.js';

type Assert<T extends true> = T;
type HasHealthEndpoint = Assert<'/health/live' extends keyof paths ? true : false>;
export type CompileTimeHealthCheck = HasHealthEndpoint;

const api = createGymApiClient({ baseUrl: 'http://localhost:3001' });
void api.GET('/health/live');
// @ts-expect-error - a misspelled route is not present in the generated contract
void api.GET('/health/not-a-real-route');
