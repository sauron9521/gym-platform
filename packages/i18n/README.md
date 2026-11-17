# @gym/i18n

Shared message catalogs for Gym Platform. Current locales: `uk` (default) and `en`.

- Keep translation strings under `src/messages/{locale}.json` with matching nested keys.
- Next.js apps consume `getMessages(locale)` via `next-intl`.
- Expo consumes `getFlatMessages(locale)` via `react-intl`.
- API error codes remain language-neutral; translate them in clients, never parse localized server text.
- For user-generated exercise names and database content, use dedicated translation tables instead of UI catalogs.

Run `pnpm --filter @gym/i18n test` before merging changes to catalogs.

This package intentionally introduces no runtime framework dependencies. Application-specific adapters, preferences, and translated routes are separate reviewable PRs.
