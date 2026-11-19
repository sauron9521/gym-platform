# Gym Platform Delivery — GitHub Project v2 setup

**Source of truth:** [#353 master roadmap](https://github.com/sauron9521/gym-platform/issues/353). Issues and Milestones **M01–M07** already exist; this setup does not recreate or modify them.

## Why local, explicitly approved setup?

GitHub Projects v2 belong to a **user account** and are not writable with the repository-scoped GITHUB_TOKEN. The GitHub ChatGPT connector currently does not expose Project mutation actions. To avoid storing a broad Projects PAT in the repository or chat, this setup runs locally with authenticated GitHub CLI (gh).

## Once, on Windows PowerShell

1. Install GitHub CLI from https://cli.github.com/ or use **winget install --id GitHub.cli**.
2. Run **gh auth login** (GitHub.com, HTTPS, browser), then **gh auth refresh -s project**. Confirm with **gh auth status**. **Do not paste tokens into chat, source files or logs.**
3. Update your local checkout to the merged version of this PR on **main**.
4. From the repository root run:

       node scripts/github-project-setup.mjs preview

   Preview reads current open Issues and the existing user-owned Projects. It should show roughly **103 active Issues** for the original snapshot (the number changes as Issues are closed or created); AI M08 and deferred E18 are deliberately excluded.

5. If the plan looks right, explicitly apply:

       node scripts/github-project-setup.mjs apply APPLY_PROJECT

The script creates or reuses **one** personal project titled **Gym Platform Delivery**, links the existing repository, configures GitHub's built-in Status field to **Backlog / Ready / In Progress / In Review / Blocked / Done**, creates four non-duplicated views, and imports open M01–M07 Epic/task Issues as **Backlog**. Existing items and manually changed statuses are preserved.

It does **not** merge PRs, close Issues, rename repositories, change Milestones, run production deployment or add AI tasks. No scheduled workflow or repository PAT secret is created. Re-run to import newly created qualifying Issues; every run defaults to Preview.

An existing project with customized Status options, duplicate title, mismatched view layout, or an Issue with an unexpected Milestone causes a fail-closed error. If interrupted during the bulk import, simply re-run Preview then Apply; previously imported items will be skipped.

## Views

- **Delivery Board:** Board layout, grouped by Status; this is the Kanban entry point.
- **Milestones:** Table layout. In GitHub UI group by the native Milestone field to compare M01–M07.
- **Priority:** Table layout. Save filters for labels priority:p0 and priority:p1.
- **Areas:** Table layout. Filter or group by area labels: Web, API, Mobile, Trainer, Admin, etc.

**Important:** the API provisions view layouts and names; final saved filters and grouping configuration can require one-time review in GitHub UI. Do not claim these filters are configured until confirmed in the UI.

## Operating rules

- The **Issue** is the primary board item; its related PRs stay linked rather than duplicated as separate cards.
- **Backlog:** untriaged or waiting. **Ready:** scope/dependencies reviewed. **In Progress:** implementation. **In Review:** PR review/CI. **Blocked:** dependency/decision. **Done:** merged, verified and closed.
- Never mark Done merely because a PR exists or CI started. PR merges remain manual.
- AI-readiness E17/M08 and deferred AI E18 stay out of this board until explicitly activated.
- Keep personal Projects credentials only in local GitHub CLI auth, not as GitHub Actions repository secrets.

Tests: pnpm test:tooling includes scripts/github-project-setup.test.mjs (no GitHub writes).
