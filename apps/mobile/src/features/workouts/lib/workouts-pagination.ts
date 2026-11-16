/** Page-number pagination must stop on the last page or malformed server metadata. */
export function nextWorkoutPage(page: { meta: { totalPages: number } }, current: number) {
  const total = page.meta.totalPages;
  if (!Number.isInteger(current) || current < 1 || !Number.isInteger(total)) return undefined;
  return current < total ? current + 1 : undefined;
}
