export const restDurationPresets = [60, 90, 120] as const;
export type RestDuration = (typeof restDurationPresets)[number];
export const defaultRestDuration: RestDuration = 90;

export function parseRestDuration(value: string | null): RestDuration {
  return restDurationPresets.find((seconds) => String(seconds) === value) ?? defaultRestDuration;
}
