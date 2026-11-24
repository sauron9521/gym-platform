export type DraftVersionChanges = {
  title?: string;
  description?: string | null;
  durationWeeks?: number | null;
};

/** Preserve omitted fields and normalize only explicitly supplied values. */
export function normalizeDraftVersionChanges(input: DraftVersionChanges): DraftVersionChanges {
  const changes: DraftVersionChanges = {};
  if (input.title !== undefined) {
    changes.title = input.title.trim();
  }
  if (input.description !== undefined) {
    changes.description = input.description?.trim() || null;
  }
  if (input.durationWeeks !== undefined) {
    changes.durationWeeks = input.durationWeeks;
  }
  return changes;
}

/** The conditional draft update no longer matches the requested version. */
export class DraftVersionStateChanged extends Error {
  constructor() {
    super('Version state has changed. Reload and try again.');
    this.name = 'DraftVersionStateChanged';
  }
}
