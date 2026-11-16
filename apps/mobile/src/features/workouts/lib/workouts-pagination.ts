/** Pure pagination helper, safe to test without React Native module resolution. */
export function nextWorkoutPage(page: { meta: { totalPages: number } }, current: number) {
  return current < page.meta.totalPages ? current + 1 : undefined;
}
