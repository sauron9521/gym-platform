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

## Scoped Turbo feasibility (report only)

A Linux dry-run using Turbo 2.11.11 against main
`10741fcb9e1a8439292d28387c821bbd3844989a` found that a conventional
`turbo run lint typecheck --filter=@gym/web` includes two additional
executable dependency typechecks (API client and shared UI). The full
dependency graph also includes non-executable task placeholders.
Replacing the existing scope classifier with this filter is not equivalent.

Explicit package task IDs with `--only` preserve the selected executable
task set. The following commands are illustrative dry-runs, not hook changes:

```sh
pnpm exec turbo run '@gym/web#lint' '@gym/web#typecheck' --only --env-mode=loose --cache=local:,remote: --concurrency=1 --dry=json
```

| Scope      | Current lint/typecheck commands | Explicit Turbo executable tasks |
| ---------- | ------------------------------: | ------------------------------: |
| Web        |                               2 |                               2 |
| API        |                               2 |                               2 |
| Shared UI  |                               8 |                               8 |
| API client |                               9 |                               9 |

The pre-push test suite now compares actual Turbo JSON plans against the
existing classifier for these scopes plus Mobile and i18n. It uses the
installed CLI through Node without passing Git filenames through a shell.
The probe does not execute the planned tasks. Formatting and API Prisma
generation remain outside this proposed batch.

**No runtime cutover yet.** Task-set parity is not runtime parity. Preserve
the direct pnpm checks until representative cold/warm timing, failure
propagation, inherited environment, Next type generation and Linux/Windows
execution are verified. The probe disables cache reads and writes to avoid
claiming safety for cached typechecks with generated output or incomplete
dependency hashes under `--only`. No speed improvement has been measured.
Do not use this result to replace the CI affected selector.
