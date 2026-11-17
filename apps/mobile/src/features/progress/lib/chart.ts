/** Normalize daily strength volume for simple, accessible percentage bars. */
export function strengthVolumeHeights(daily: readonly { strengthVolumeKg: number }[]): number[] {
  const volumes = daily.map(({ strengthVolumeKg }) =>
    Number.isFinite(strengthVolumeKg) ? Math.max(0, strengthVolumeKg) : 0,
  );
  const max = Math.max(0, ...volumes);
  if (max === 0) return volumes.map(() => 0);
  return volumes.map((volume) => (volume === 0 ? 0 : Math.max(3, Math.round((volume / max) * 100))));
}
