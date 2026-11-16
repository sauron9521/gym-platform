# Gym Platform Landing

Публічний презентаційний сайт Gym Platform у Turborepo. Дизайн-напрямок: **Dark Performance** —
темний графітовий фон, лаймові акценти, контрастні заголовки. Тема вмикається
за замовчуванням; перемикач світлої теми наразі не планується.

## Стек

Next.js 16 (App Router), React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui
та FSD-підходи, узгоджені з `apps/web`. Публічні сторінки використовують
Server Components без API-клієнта та авторизації.

## Локальний запуск

З кореня репозиторію:

```bash
pnpm install --frozen-lockfile
pnpm dev:landing
```

Landing: http://localhost:3002. Web: http://localhost:3000. API: http://localhost:3001.

Перевірки:

```bash
pnpm --filter @gym/landing lint
pnpm --filter @gym/landing typecheck
pnpm --filter @gym/landing build
```

## Структура

- `src/app` — маршрути Next.js, metadata, robots і sitemap;
- `src/widgets/layout` — шапка й підвал;
- `src/widgets/content` — спільний шаблон контентних сторінок;
- `src/widgets/home` — головна;
- `src/shared/config/navigation.ts` — навігація та індексовані маршрути;
- `src/shared/lib/seo.ts` — метадані й налаштування публічного походження;
- `src/shared/ui` — shadcn/ui, `src/app/globals.css` — колірні токени.

Наразі розділи містять короткі вступи й повідомлення про розробку. Остаточні
тексти, скриншоти, посилання на застосунки та інтерактивні можливості
додаватимуться окремими PR.

## SEO та домен

Без `LANDING_SITE_URL` сайт **не індексується**, `robots.txt` забороняє
обхід, `sitemap.xml` порожній, а canonical URL не генеруються.
Для індексації потрібен підтверджений публічний HTTPS-домен, наприклад:

```dotenv
LANDING_SITE_URL=https://your-domain.example
```

Значення має бути **HTTPS origin** без шляху чи query. Не задавайте його
для localhost і не вмикайте індексацію до затвердження контенту.
Ця конфігурація не забезпечує захист даних або доступу до сайту.

## Smoke tests

Run `pnpm --filter @gym/landing test` to validate public navigation routes,
SEO origin rules and metadata before building. The Landing build runs these
regressions first, while the existing Next.js build validates compilation.
The tests deliberately require no domain, browser, credentials or network.
