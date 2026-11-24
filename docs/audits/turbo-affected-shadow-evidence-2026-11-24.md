# Turbo affected shadow audit — first observed evidence (2026-11-24)

**Decision: NO-GO for full replacement of `scripts/ci-select.mjs`.**
Keep the conservative GitHub CI selector and protected result gates unchanged.

## Primary evidence

- [Read-only manual Tooling audit run #45363672094](https://github.com/sauron9521/gym-platform/actions/runs/45363672094): **success**, on `main` at `29176e1c1535d3eaade1e8f071ae3ab4982386ae`.
- Artifact: `tooling-audit-45363672094`, generated 2026-11-24. Its `turbo-affected-history.json`, `turbo-affected-comparison.json`, `turbo-affected-plan.json` and `turbo-plan.json` are source evidence. The artifacts are retained for seven days, not indefinitely.
- `history_samples = 8` produced **five distinct categories from 80 examined first-parent commits**, not eight. Missing categories are **not validated**.

## Observed comparisons

- **Cross-cutting / tooling:** main commit `29176e1c1` changed a manual workflow, docs and CI diagnostic scripts. `ci-select.mjs` demanded **all seven application/client workspaces** via fail-closed `full: true`. Turbo selected **zero** lint/typecheck/build packages. Status: `review-required`; seven missing packages. This is an important **policy/graph coverage gap**, not evidence that the required full check is unnecessary.
- **Docs-only:** `5f671b1b3`. Both selected zero application/client packages; no discrepancy.
- **Mixed / root manifest and lockfile:** `b4569136c`. Both included all seven required application/client packages; Turbo additionally included shared packages. This observation does not cover all root or infrastructure edits.
- **Landing-only:** `7a26bc357`. Both included Landing; Turbo additionally included shared build dependencies. No required application/client package missing.
- **API-only:** `1f3fe1c22`. Both included API. No required application/client package missing.

The latest-commit standalone comparison reproduced the cross-cutting gap:
`ca96b18db9130d3caa56671bc01d2a6da6712806...29176e1c1535d3eaade1e8f071ae3ab4982386ae`.
All five historical comparisons evaluated **today's workspace graph**, not reconstructed historical dependency graphs.

## What this proves and does not prove

The success of the GitHub Action means the **diagnostic commands completed**; it does **not** mean all compared scopes matched. In particular, a dry-run of `turbo --affected` does not model required API PostgreSQL E2E, security, staging, release eligibility or protected job-result gates.

The verified cross-cutting gap is sufficient to **reject a direct replacement** of the existing policy selector by `turbo --affected` alone. API, Landing, docs and one mixed sample have no missing application/client packages, but that does not establish equivalence for Web, Admin, Trainer, Mobile, OpenAPI, API client, i18n, design tokens, UI or other mixed paths.

`dependency-cruiser` boundary reporting passed. The Knip report still flags candidate unused files (including real Playwright E2E specifications and test helpers); these are not verified deletions and Knip remains report-only.

## Follow-up decisions

1. **P1 — retain** `ci-select.mjs` and its fail-closed full-scope fallback for workflow, tooling, unknown, security, manifest and infrastructure changes. Keep the current required job names, API/real-browser E2E and release gates.
2. **P1 — do not enable Turbo as the required selector** until a separate parity review covers the missing paths and negative tests, including actual GitHub workflow scheduling semantics.
3. **P2 — consider a hybrid approach** only after evidence: keep policy-based full-scan and release requirements authoritative, and optionally use Turbo for build/lint/typecheck task planning in tightly scoped workspace changes. Quantify any runtime benefit before introducing more complexity.
4. **P2 — prioritize Knip false-positive triage** for existing Web integration tests and other real entrypoints before enabling Knip as a blocking rule or deleting dependencies. Then evaluate pre-push simplification with Husky/lint-staged.
5. Re-run the manually dispatched shadow audit for specifically chosen `base_sha`/`head_sha` pairs representing remaining categories, using the current `main` checkout. Record actual artifacts rather than treating synthetic tests as empirical parity.

**Owner gate:** This document records observed read-only evidence and a technical recommendation, not approval to change protected CI or delete custom scripts.
