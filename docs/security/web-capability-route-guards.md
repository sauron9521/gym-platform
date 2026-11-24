# Web route capability guards — M05 / #361

The existing Athlete Web contains temporary Trainer routes while the independent `apps/trainer` workspace is partially implemented and legacy cutover remains pending. These legacy pages must apply the same **current persisted account capabilities** as NestJS before rendering trainer or athlete UI; they cannot rely on the legacy `role` in `GET /users/me`.

## Server verification

`apps/web/src/shared/api/server-session.ts` keeps `verifyServerSession` as the compatibility-safe `/users/me` projection used by profile and dashboard navigation. Pages requiring a specific side call `verifyServerCapability(cookieHeader, 'trainer' | 'athlete')`.

- Server verifies the incoming cookie using uncached `GET /users/me` and then reads uncached `GET /users/me/capabilities` **from the same fixed internal API origin**. Neither the client nor a cookie attribute chooses the upstream, the user, or grants.
- Only `authenticated` plus an explicit `trainer: true` / `athlete: true` with `admin: false` renders the requested UI. Admin, declined/revoked and insufficient-capability sessions get a denial. 401 redirects to login. Malformed responses, timeouts, non-200 responses other than 401/403, or API outages result in an unavailable state, **not access**.
- Approved `ATHLETE`-role trainers have both views; legacy `TRAINER` users without a `TrainerProfile` retain both views. An inactive `TrainerProfile` removes trainer access even when the current role remains `TRAINER`, without removing the user's own Athlete screens.
- Server-side routes are dynamic (`force-dynamic`); private data must not be stored in a reusable shared cache. The API remains authoritative for object ownership, IDOR prevention, writes, and revocation races.
- A Next page is **not** a security barrier for API endpoints. Backend policies remain independently enforced. The independent Trainer sign-in and protected workspace now exist; see the [Trainer guide](../../apps/trainer/README.md).

## Coverage

`apps/web/test/server-session.test.mjs` covers fixed-origin/cookie-only no-store requests, legacy role mismatches, revoked admins, fail-closed behavior, malformed grants, missing sessions and API failures.

`apps/web/e2e/integration/live-capability-route-guards.spec.ts` runs against the real Nest API and a disposable PostgreSQL database. With a **single browser session**, it checks ATHLETE → approved dual-capability trainer → revoked trainer → revoked legacy TRAINER → legacy TRAINER without profile → ADMIN, verifying server route gates on trainer programs/new/athletes and athlete programs/trainers.

Use `pnpm --filter @gym/web test` and the existing Web Integration E2E workflow; the latter requires a disposable test database. Independent Trainer Web cookie/CSRF and native bearer-client integration regressions also exist in `trainer-web-auth.spec.ts` and `mobile-token-capabilities.spec.ts`. Physical-device and deployed-host acceptance remain separate gates.
