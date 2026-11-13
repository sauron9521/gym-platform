# Contributing to Gym Platform

## Local quality gates

Install dependencies from the repository root with `pnpm install --frozen-lockfile`.
The root `prepare` script installs Husky. Ensure that Git uses the installed
Husky hooks (typically `.husky/_`).

- **pre-commit:** `lint-staged` runs `prettier --write` on staged files, and
  re-stages formatted content before creating the commit.
- **pre-push:** `pnpm format:check`, Web lint and Web typecheck must all pass.
  This hook intentionally does **not** rewrite commits that already exist.
- **CI:** checks format, lint, types, tests and build independently of local hooks.

Changes written through GitHub's web/API interfaces do not invoke local Git
hooks. Contributors using those interfaces must format the code before sending
the commit. Never use `--no-verify` to bypass these checks in ordinary work.

To format manually before staging:

```bash
pnpm exec prettier --write apps/web/src/features/profile
git add apps/web/src/features/profile
git commit -m "feat(web): example"
```

If a hook is missing after installation, run `pnpm exec husky` or reinstall
with `pnpm install`, and inspect `git config core.hooksPath`.
