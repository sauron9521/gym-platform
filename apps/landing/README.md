# Gym Platform Landing

Публічний презентаційний сайт платформи Gym Platform у монорепозиторії Turborepo.

## Стек

Next.js 16 (App Router), React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui та
Feature-Sliced Design (FSD), узгоджені з `apps/web`. Основні залежності та
версії синхронізовані з вебзастосунком.

Поточний етап — лише стартова сторінка і базова конфігурація. Розділи,
маршрути, контент, SEO-схеми та публічні посилання на інші застосунки будуть
додані після погодження структури сайту. API, авторизація і сховище даних
поки не потрібні.

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

## Архітектура

- `src/app` — Next.js App Router, метадані та глобальні стилі.
- `src/widgets` — композиція UI-розділів.
- `src/shared/ui` — shadcn/ui компоненти.
- `src/shared/lib` — спільні локальні утиліти.

Не імпортуйте внутрішні модулі з `apps/web` через відносні шляхи.
Якщо з'явиться справді спільний UI, його слід винести в `packages/` окремим PR.
