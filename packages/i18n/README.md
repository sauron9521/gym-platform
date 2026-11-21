# @gym/i18n

Shared message catalogs for Gym Platform. Current locales: `uk` (default) and `en`.

- Keep translation strings under `src/messages/{locale}.json` with matching nested keys.
- Next.js apps consume `getMessages(locale)` via `next-intl`.
- Expo consumes `getFlatMessages(locale)` via `react-intl`.
- `resolveRequestLocale(explicitLocale, acceptLanguage)` is the shared server-side locale
  negotiator: a supported explicit cookie/preference wins, otherwise use the highest
  supported `Accept-Language` quality weight, then fall back to `uk`. Web and Admin
  keep their application import paths as compatibility re-exports.
- API error codes remain language-neutral; translate them in clients, never parse localized server text.
- For user-generated exercise names and database content, use dedicated translation tables instead of UI catalogs.

Translation keys are exported as TypeScript `TranslationKey` dotted leaf IDs; use the type in
consumers that accept shared catalog keys to catch misspellings at compile time.
`pnpm --filter @gym/i18n check` parses ICU messages and checks that both locales contain
non-empty keys with the same argument names and formatting kinds (plural categories may differ).
The same validation runs automatically under `pnpm --filter @gym/i18n test`.
For request-locale changes also run `pnpm --filter @gym/web test` and
`pnpm --filter @gym/admin test`.

This package intentionally introduces no runtime framework dependencies. Application-specific adapters, preferences, and translated routes are separate reviewable PRs.

For Next.js request boundaries, `getMessagesAsync(locale)` from `@gym/i18n/async` imports only the selected language. Expo's `getFlatMessages(locale)` is memoized and frozen per locale. Avoid sending unused namespaces to `NextIntlClientProvider` as catalogs grow.
