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
- Server-side trusted-origin `/backend/*` rewrite is installed for future authenticated integration. **Do not treat this rewrite, the shell, or any client-side navigation as authorization.** `#363` will add Trainer sign-in, host-specific session handling, CSRF/origin checks, server route guards and tests. `#291/#309–311/#361` supply approved Trainer capabilities.
- The shared `gym-locale` cookie controls uk/en with Accept-Language fallback, and `ovranto-theme` follows OS Light/Dark by default with manual override. Cookie values never confer privileges.
- This app has `robots: noindex` until a controlled release and verified auth. No production domain or deployment is enabled here.
- Subsequent work: #363 auth, #364 dashboard, #365 focused 3-pane Program Builder, #366 assignments/feedback, #369 browser E2E/CI release gating.

Architecture: [ADR-005](../../docs/architecture/adr-005-product-ownership-trainer-migration.md). Visual design: OVRANTO Premium Athletic Minimal, full Light/Dark, responsive sidebar; builder remains a separate step.
