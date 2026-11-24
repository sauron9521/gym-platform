# GitHub Milestones — Gym Platform

The canonical map is [master roadmap #353](https://github.com/sauron9521/gym-platform/issues/353).
Existing Issues use structured labels: type, priority, area, and phase M01–M08.

## One-time manual setup

1. Review and **manually merge** the PR that introduces this workflow.
2. In GitHub **Actions → Roadmap milestones / manual sync → Run workflow**, select
   **main**, **mode = preview** (the default), and inspect the planned milestone counts.
3. To apply, run again with **mode = apply**, **confirmation = APPLY_MILESTONES** and
   **include_ai_readiness = false**. This creates seven active milestones **M01–M07**
   without due dates and assigns the labeled open Issues.
4. Verify **Issues → Milestones** and individual assignments. Re-running is safe:
   the script reuses a matching existing milestone and skips already-assigned Issues.

M08 (AI readiness) is optional, off by default. Deferred AI integration **E18**
and global roadmap Issues #317/#353/#380 stay without a milestone.

The workflow only runs on manual dispatch from **main**, with an explicit confirmation
required for writes. The repository-scoped Actions token needs **issues: write**.
It does **not** close Issues, merge PRs, publish, deploy, or update live services.
An inconsistent or closed milestone and conflicting phase labels fail the plan
before any changes. A partial write failure can be recovered by rerunning it.
The action verifies the issue assignments after applying.

## Optional GitHub Project

Creating a user-level GitHub **Projects v2** board is not guaranteed by the limited
repository Actions token; this workflow deliberately does not try. Suggested project
name: **Gym Platform Delivery**, with Status values **Backlog / Ready / In Progress /
In Review / Blocked / Done**, plus views filtered by phase, priority and area labels.
Do not treat labels as proof of implementation progress; the appropriate tests and
manual QA still determine completion.

## Development

Run the node test file **scripts/roadmap-milestones.test.mjs**.
GitHub PR CI does not invoke the milestone writer and cannot create milestones
on behalf of a PR.
