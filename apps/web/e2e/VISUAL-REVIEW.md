# OVRANTO visual review — opt-in evidence (E19)

This is an initial **manual** Playwright Chromium screenshot harness for the approved
OVRANTO Light/Dark visual direction. It deliberately does **not** use
`toHaveScreenshot()`, create or approve golden baselines, or gate pull requests on
pixel differences. The approved design references are tracked in issues #381,
#383, #384, #389 and #392.

## Capture from GitHub Actions (after PR #429 is merged)

Go to **Actions → OVRANTO Web visual review → Run workflow**, select
the `main` branch and start the manual run. The workflow does not run on
pull requests or pushes and rejects non-`main` branches. It uses only
the loopback fixture API and test accounts; no deployment secrets or real
user data are needed.

After the run completes, download **ovranto-web-visual-review-<run id>**
from the run's **Artifacts** section. Extract the ZIP to find:

- `playwright-report/`: HTML report with images attached to each of
  the eight locale/theme/viewport cases.
- `test-results/`: the 24 named full-page PNGs, organized into the
  eight test case directories; failure traces may also be present.

Open the report with `pnpm --filter @gym/web exec playwright show-report
<path-to-extracted-playwright-report>` or inspect the PNGs directly.
Artifacts are retained for **7 days**; download review evidence before
it expires. A green manual run confirms captures were produced, **not**
that the visuals were approved or pixel-identical to the mockups.

The new workflow becomes available in the Actions tab **after merging**
its workflow file into the default branch; PR CI cannot prove the manual
dispatch itself ran.

## Capture on a developer machine

Install dependencies and Chromium first:

```sh
pnpm install --frozen-lockfile
pnpm --filter @gym/web exec playwright install chromium
```

From the repository root on **PowerShell**:

```powershell
$env:OVRANTO_VISUAL_CAPTURE = '1'
pnpm --filter @gym/web exec playwright test ovranto-visual-review.spec.ts --reporter=html
Remove-Item Env:OVRANTO_VISUAL_CAPTURE
pnpm --filter @gym/web exec playwright show-report
```

On **Bash**, use
`OVRANTO_VISUAL_CAPTURE=1 pnpm --filter @gym/web exec playwright test ovranto-visual-review.spec.ts --reporter=html`.

The tests start the existing loopback-only fixture API and real Next.js Web
development server. They capture full-page **Login**, **Athlete Dashboard** and
**Workouts** views in all eight combinations:

- Locale: `uk`, `en`
- Theme: `light`, `dark`
- Viewport: 390×844 mobile, 1280×900 desktop

The PNG images are attached to individual Playwright tests in
`apps/web/playwright-report/` and stored as named files in `apps/web/test-results/`;
both reports and test outputs are ignored by Git.
This is not a replacement for screenshots taken on real mobile devices.

## Review policy

Compare images with the **owner-approved OVRANTO mockups**, not with arbitrary
legacy screenshots. Review typography/wordmark, Deep Teal primary actions,
Terracotta accents, color and status semantics, overflow, density, hierarchy,
localization and legibility in both themes. Note any variance in issue #389 with
the test case, viewport, theme and screen name.

The fixture API provides deterministic **test data**, not real user metrics or
proof of implemented roadmap features. Manually review loading/empty/error
states, native screens, Safari, VoiceOver/TalkBack and reduced-motion behavior
separately. Color contrast and semantic accessibility are also covered by
dedicated axe/browser tests; screenshots alone cannot verify WCAG compliance.

**Do not commit generated PNG baselines or make screenshot comparisons required
CI checks until representative approved, stable reference screens and a baseline
update/review policy are explicitly signed off.** Ordinary CI intentionally skips
these opt-in captures; functional, responsive and axe checks continue to run.
