# Selective pre-push checks

The Husky pre-push hook reads Git's ref updates from stdin and compares the
local and remote commit tips. On the **first push of a new branch** it uses
the merge-base with `origin/main`, instead of checking every historical commit.

- Web-only: Prettier for changed supported files, Web lint and typecheck.
- Mobile-only: Prettier, Mobile lint and typecheck.
- API-only: Prettier, generate Prisma client, API lint and typecheck.
- Shared API client: shared typecheck plus Web and Mobile lint and typecheck.
- Documentation-only: Prettier for changed supported files; no workspace lint.
- Root dependencies, CI, tooling or unknown paths: full Prettier, workspace
  lint and typecheck, with Prisma client generation first.

For multiple refs in one push, the script checks the union of their changes.
Deleted refs publish no new code. Deleted files are excluded from formatting.
Git failures, invalid ref input or a missing `origin/main` fall back to the
whole-repository checks: **never silently skip source verification**.

The hook does not run expensive E2E or Docker jobs. GitHub Actions remains the
source of truth for mandatory PR checks and main branch protection.

To verify the selection logic, run:

```sh
node --test scripts/pre-push-checks.test.mjs
```

To bypass a hook intentionally for a local one-off diagnostic, set
`HUSKY=0` only if you understand that GitHub CI will still enforce the
required checks. Do not disable branch protection.
