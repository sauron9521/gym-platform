/** Pure countdown math, independent of interval timing and app lifecycle. */
export function formatRestTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const remainder = String(safe % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function secondsRemaining(deadline: number, now: number): number {
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
