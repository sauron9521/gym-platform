# Gym Platform Web

Next.js App Router + TypeScript + Tailwind CSS 4 + shadcn/ui, managed by pnpm Workspaces and Turborepo.

## Start

From the monorepo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @gym/web dev
```

Open http://localhost:3000.

## Quality checks

```bash
pnpm --filter @gym/web lint
pnpm --filter @gym/web typecheck
pnpm --filter @gym/web test
pnpm --filter @gym/web build
```

## Architecture

- `src/app/` — Next.js routing, layouts, and global styles.
- `src/widgets/` — page-level sections (Feature-Sliced Design).
- `src/shared/ui/` — reusable shadcn/ui components.
- `src/shared/lib/` — shared utilities.

Add shadcn/ui components from `apps/web` with `pnpm dlx shadcn@latest add <component>`.
Keep code in the appropriate FSD slice; do not add a Next.js `src/pages` directory.
