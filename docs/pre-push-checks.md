# Selective pre-push checks

The Husky pre-push hook reads Git's ref updates from stdin and compares the
local and remote commit tips. On the **first push of a new branch** it uses
the merge-base with `origin/main`, instead of checking every historical commit.

- Web-only: Prettier for changed supported files, Web lint and typecheck.
- Mobile-only: Prettier, Mobile lint and typecheck.
- API-only: Prettier, generate Prisma client, API lint and typecheck.
- Landing, Admin or Trainer-only: Prettier and that workspace lint/typecheck.
- Shared API client: client typecheck plus Web, Admin, Trainer and Mobile lint/typecheck.
- Shared UI, design tokens, i18n and tooling config: consumer scopes follow the [CI routing policy](ci-affected-workspaces.md); API scope also generates Prisma.
- Exempt documentation-only paths: Prettier for changed supported files; no workspace lint. Other Markdown uses the same conservative path rules as CI.
- Root dependencies, CI, tooling or unknown paths: full Prettier, workspace
  lint and typecheck, with Prisma client generation first.

For multiple refs in one push, the script checks the union of their changes.
Deleted refs or valid ref updates with no net file changes require no local checks. Deleted files still select affected
workspaces, but are excluded from scoped formatting. A move between workspaces
is treated as a deletion plus an addition. If the same path is deleted in one
ref and present in another, the hook falls back to the full check plan.
Git failures, malformed diff output, invalid ref input or a missing
`origin/main` fall back to whole-repository checks: **never silently skip
source verification**.

The hook uses explicit pnpm workspace commands, not a Turbo affected replacement. Scoped formatting falls back to full formatting above 100 supported paths. It does not run expensive E2E or Docker jobs. GitHub Actions remains the
source of truth for mandatory PR checks and main branch protection.

To verify the selection logic, run:

```sh
pnpm test:tooling scripts/pre-push-checks.test.mjs
```

To bypass a hook intentionally for a local one-off diagnostic, set
`HUSKY=0` only if you understand that GitHub CI will still enforce the
required checks. Do not disable branch protection.

## Windows process safety

Windows pnpm typically uses a `.cmd` shim, which needs `cmd.exe` to
launch. The hook allows that shell **only for an explicit allowlist of
filename-free, fixed pnpm commands** (lint, typecheck, Prisma generation
and full formatting).

Scoped Prettier checks are different: changed Git filenames are untrusted
arguments and can contain spaces or shell metacharacters. The hook invokes
the installed Prettier CLI directly using `process.execPath` and an argument
array with `shell: false`. This keeps each filename literal and prevents
Windows command expansion or accidental invocation of other commands.
Unexpected command shapes fail the push instead of entering a shell.

The CI runs pre-push unit tests on Linux and, for cross-cutting changes,
on a Windows runner. A passing Windows test covers the argument handling;
interactive Git for Windows / Corepack end-to-end behavior still depends
on the local installation.
