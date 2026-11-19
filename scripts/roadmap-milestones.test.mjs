import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildPlan, issuePhase, milestoneCode, milestones } from './roadmap-milestones.mjs';

const issue = (number, labels, milestone = null) => ({
  number,
  labels: labels.map((name) => ({ name })),
  milestone,
});

describe('safe manual GitHub milestone sync', () => {
  it('has seven current outcomes and optional AI-readiness', () => {
    assert.deepEqual(
      milestones.slice(0, 7).map(([code]) => code),
      ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07'],
    );
    assert.equal(milestoneCode('M01 — Identity'), 'M01');
    assert.equal(milestoneCode('M01x — Invalid'), null);
  });

  it('does not assign roadmaps, pull requests, deferred AI or optional M08', () => {
    assert.equal(issuePhase(issue(353, ['type:roadmap', 'phase:M01'])), null);
    assert.equal(issuePhase({ ...issue(44, ['type:task', 'phase:M01']), pull_request: {} }), null);
    assert.equal(issuePhase(issue(358, ['type:epic', 'status:deferred'])), null);
    assert.equal(issuePhase(issue(357, ['type:epic', 'phase:M08'])), null);
    assert.equal(issuePhase(issue(357, ['type:epic', 'phase:M08']), true), 'M08');
  });

  it('reuses matching milestones and is idempotent', () => {
    const saved = { number: 5, title: 'M01 — Identity', state: 'open' };
    const plan = buildPlan(
      [
        issue(281, ['type:epic', 'phase:M01']),
        issue(288, ['type:task', 'phase:M01'], saved),
        issue(389, ['type:task', 'phase:M02']),
      ],
      [saved],
    );
    assert.deepEqual(plan.assign, [
      { issueNumber: 281, code: 'M01' },
      { issueNumber: 389, code: 'M02' },
    ]);
    assert.equal(plan.alreadyAssigned, 1);
    assert.equal(plan.create.length, 6);
  });

  it('fails closed on conflicting state before writing', () => {
    assert.throws(
      () => issuePhase(issue(42, ['type:task', 'phase:M01', 'phase:M02'])),
      /Conflicting/,
    );
    assert.throws(
      () =>
        buildPlan(
          [
            issue(281, ['type:epic', 'phase:M01'], {
              title: 'M02 — Other',
              number: 2,
            }),
          ],
          [],
        ),
      /Unexpected/,
    );
    assert.throws(
      () =>
        buildPlan(
          [],
          [
            { title: 'M01 — A', number: 1, state: 'open' },
            { title: 'M01 — B', number: 2, state: 'open' },
          ],
        ),
      /Duplicate/,
    );
  });
});
