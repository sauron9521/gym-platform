// Proposed horizons, disabled until explicit operator approval.
export const INBOX_RETENTION_DAYS = 90;
export const DELIVERY_RETENTION_DAYS = 30;
export const RETENTION_BATCH_LIMIT = 50;
export type RetentionMode = 'off' | 'preview' | 'apply';
export type RetentionResult = {
  mode: Exclude<RetentionMode, 'off'>;
  acquired: boolean;
  inbox: number;
  email: number;
};
