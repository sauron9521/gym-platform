/** A rejected request is different from a lost response: only the latter needs a GET. */
export function isUncertainWorkoutSetResponse(status: number, hasData: boolean): boolean {
  // 408 can occur after the server began processing; 5xx may follow a commit.
  // A 200 without a usable body also cannot prove what the server stored.
  return status === 0 || status === 408 || status >= 500 || (status === 200 && !hasData);
}

/** No automatic retry is safe: the server might already have committed the PATCH. */
export class WorkoutSetOutcomeUnknownError extends Error {
  canonicalStateVerified = false;
  /** Proof version captured after the failed verification attempt, not at submit time. */
  readVersionAtFailure = 0;

  constructor() {
    super('Результат збереження невідомий. Перевірте стан підходу на сервері перед новою дією.');
    this.name = 'WorkoutSetOutcomeUnknownError';
  }
}
