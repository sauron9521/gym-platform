# Gym Platform Landing

Публічний презентаційний сайт OVRANTO у Turborepo. Дизайн-напрямок: **Premium Athletic Minimal** — спільні семантичні токени OVRANTO v2, Deep Teal, Terracotta, теплі світлі та темні поверхні. Підтримуються System / Light / Dark; початкова тема читається із локального cookie на сервері. Деталі: [візуальна ідентичність](../../docs/landing/visual-identity.md) та [Design Tokens](../../packages/design-tokens/README.md).

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

## Публічні маршрути

`/`, `/features`, `/for-athletes`, `/for-trainers`, `/apps`, `/apps/web`, `/apps/mobile`, `/about`. Локалізовані маршрути `/uk` та `/en` керуються налаштуванням публікації та готовністю перекладів; див. [політику локалізації](../../docs/landing/localization.md). Наявність сторінки не підтверджує публічну доступність продукту чи дозвіл на індексацію.

## Структура

- `src/app` — маршрути Next.js, metadata, robots і sitemap;
- `src/widgets/layout` — шапка й підвал;
- `src/widgets/content` — спільний шаблон контентних сторінок;
- `src/widgets/home` — головна;
- `src/shared/config/navigation.ts` — навігація та індексовані маршрути;
- `src/shared/lib/seo.ts` — метадані й налаштування публічного походження;
- `src/shared/ui` — shadcn/ui, `src/app/globals.css` — колірні токени.

Головна містить продуктові прев’ю Athlete і Coach у двох темах, сценарії використання та CTA. Прев’ю є знімками інтерфейсів із синтетичними даними, а не доказом публічного запуску. Зовнішні посилання на застосунки залежать від підтвердження доступності та release gates. Див. [локалізацію](../../docs/landing/localization.md) та [готовність до запуску](../../docs/landing/production-readiness.md).

## SEO та домен

Без `LANDING_SITE_URL` сайт **не індексується**, `robots.txt` забороняє
обхід, `sitemap.xml` порожній, а canonical URL не генеруються.
Для індексації потрібні підтверджений публічний HTTPS-домен і окремий явний дозвіл `LANDING_ALLOW_INDEXING=true` після перевірки release gates. Приклад конфігурації домену (сам по собі не вмикає індексацію):

```dotenv
LANDING_SITE_URL=https://your-domain.example
```

Значення має бути **HTTPS origin** без шляху чи query. Не задавайте його
для localhost і не вмикайте індексацію до затвердження контенту.
Ця конфігурація не забезпечує захист даних або доступу до сайту.

## Marketing UI Kit

Маркетингові компоненти розташовані в `src/shared/ui/marketing`.
Вони використовують наявні компоненти `@gym/ui-web` (Button і Card),
кольори з `@gym/design-tokens` та не потребують нових залежностей.

- `Container` — спільна максимальна ширина та адаптивні поля.
- `MarketingSection` — семантична секція зі стандартними відступами та варіантом `subtle`.
- `SectionHeading` — заголовок рівня H2 з необов’язковими eyebrow, описом і центруванням.
- `FeatureCard` — картка продуктового сценарію з доступним внутрішнім посиланням.
- `CallToAction` — готовий CTA-блок з основним та необов’язковим додатковим посиланням.

`HomeScreen` використовує маркетингові примітиви, окремі секції hero, product discovery, workflow та фінальний CTA. CSS-анімації та scroll enhancement мають статичний fallback і враховують `prefers-reduced-motion`; деталі та обмеження описані у [візуальному посібнику](../../docs/landing/visual-identity.md).

Компонентні перевірки: `pnpm --filter @gym/landing test:components`.

## Smoke tests

Run `pnpm --filter @gym/landing test` to validate public navigation routes,
SEO origin rules and metadata before building. Run these tests explicitly: the Landing build script runs `next build` and validates compilation.
The tests deliberately require no domain, browser, credentials or network.

## Real-browser smoke checks

Run `pnpm --filter @gym/landing test:e2e` to start an isolated Next.js Landing
server at `127.0.0.1:3302` and verify desktop navigation, mobile menu,
canonical metadata, robots and sitemap using Playwright Chromium.
CI runs this only when Landing or its shared dependencies change, and the
stable Quality gate blocks merging on failed browser checks.
