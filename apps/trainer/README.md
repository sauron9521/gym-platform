# OVRANTO Trainer Web

Independent **Trainer** Next.js 16 + React 19 application in the existing pnpm/Turborepo workspace. This is the M05/#362 **bootstrap**, not the finished trainer product.

## Local development

Run from the monorepo root:

```bash
pnpm install --frozen-lockfile
pnpm dev:trainer
```

Open http://localhost:3004. Other local ports remain API 3001, Landing 3002, Admin 3003 and Athlete Web as configured. Set `GYM_API_INTERNAL_URL` using `.env.example` only to a trusted server origin; never use `NEXT_PUBLIC_*` for an internal API URL.

```bash
pnpm --filter @gym/trainer lint
pnpm --filter @gym/trainer typecheck
pnpm --filter @gym/trainer test
pnpm --filter @gym/trainer build
```

## Product and security boundaries

- One existing `User` identity and one NestJS API. No second Trainer users/passwords/service.
- `src/app` owns routes, `src/widgets` owns presentation shell and `src/shared` holds local utilities following FSD boundaries.
- Use `@gym/design-tokens/ovranto.css`, `@gym/ui-web`, `@gym/i18n` and `@gym/api-client`. No copied Athlete Web component tree.
- Root displays **only public bootstrap information**, never mock athlete data, private API responses or role-based content. Sidebar links to unimplemented features are disabled and do not imply access.
- `/workspace` is the first protected server-only route. It makes an uncached request to the trusted API `/users/me/capabilities` with only the incoming `Cookie` header; access requires `trainer: true` and `admin: false`. Missing/expired cookies, pending/revoked permissions, malformed grants and API outages fail closed. This route renders no private athlete data yet.
- `/login` uses browser credentials against same-origin `/backend/auth/login` (the existing NestJS login), validates `/backend/users/me/capabilities` before entering `/workspace`, and best-effort signs out newly issued unapproved/MFA sessions. Only the API issues the host-only session cookie; the client never reads session tokens. Set API `TRAINER_APP_URL` to the exact Trainer origin (and add it to `CORS_ORIGINS`); Nest already checks CSRF Origin for cookie-auth writes.
- **No private-data authorization happens in client code.** `/workspace` rechecks live server grants and the Nest API enforces data authorization. Host-only cookie and Origin protections require live end-to-end deployment/browser verification; session logout UX and real Trainer browser/PostgreSQL auth matrix are further #363 slices. No separate passwords or new JWTs.
- The shared `gym-locale` cookie controls uk/en with Accept-Language fallback, and `ovranto-theme` follows OS Light/Dark by default with manual override. Cookie values never confer privileges.
- This app has `robots: noindex` until a controlled release and verified auth. No production domain or deployment is enabled here.
- Subsequent work: #363 auth, #364 dashboard, #365 focused 3-pane Program Builder, #366 assignments/feedback, #369 browser E2E/CI release gating.

Architecture: [ADR-005](../../docs/architecture/adr-005-product-ownership-trainer-migration.md). Visual design: OVRANTO Premium Athletic Minimal, full Light/Dark, responsive sidebar; builder remains a separate step.
