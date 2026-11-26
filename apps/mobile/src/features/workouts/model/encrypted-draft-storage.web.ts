import type { EncryptedOfflineDraftStorage } from './encrypted-draft-storage';

const unsupported = async (): Promise<never> => {
  throw new Error('encrypted-draft-storage-unavailable');
};

/** Browser storage is deliberately unsupported for private workout drafts. */
export const encryptedOfflineDraftStorage: EncryptedOfflineDraftStorage = {
  read: unsupported,
  write: unsupported,
  remove: unsupported,
  prepareVerifiedOwner: unsupported,
  purgePersistedOwner: unsupported,
};
