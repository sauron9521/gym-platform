/** A conflicting draft or version was created while cloning the published snapshot. */
export class DraftVersionCreationConflict extends Error {
  constructor() {
    super('A draft version already exists or was created concurrently');
    this.name = 'DraftVersionCreationConflict';
  }
}
