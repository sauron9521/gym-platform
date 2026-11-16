export function strengthVolumeHeights(daily: readonly { strengthVolumeKg: number }[]) {
  const max = Math.max(1, ...daily.map((item) => item.strengthVolumeKg));
  return daily.map((item) => Math.max(3, Math.round((item.strengthVolumeKg / max) * 100)));
}
