import axe from 'axe-core';
import { expect, type Page } from '@playwright/test';

// Use the already locked axe-core engine directly. No CDN, application bundle,
// or additional adapter is needed for the Playwright browser context.
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function expectNoAxeWcagViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });

  const results = await page.evaluate(async (tags) => {
    const browserAxe = (window as typeof window & { axe: typeof axe }).axe;
    const audit = await browserAxe.run(document, {
      runOnly: { type: 'tag', values: tags },
    });

    return {
      checks: audit.passes.length + audit.violations.length,
      violations: audit.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => {
          const selector = node.target[0];
          const element = typeof selector === 'string' ? document.querySelector(selector) : null;
          return {
            target: node.target,
            html: node.html,
            ariaLabel: element?.getAttribute('aria-label') ?? null,
            innerText: element instanceof HTMLElement ? element.innerText : null,
            textContent: element?.textContent ?? null,
            failureSummary: node.failureSummary,
          };
        }),
      })),
    };
  }, wcagTags);

  // Prevent an accidentally empty scan from turning this assertion into a no-op.
  expect(results.checks, 'axe-core must evaluate accessibility rules').toBeGreaterThan(0);
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}
