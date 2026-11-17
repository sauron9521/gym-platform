/** Server pagination is 1-based; never ask for a page beyond the reported total. */
export function nextAssignmentPage(currentPage: number, totalPages: number): number | undefined {
  if (!Number.isSafeInteger(currentPage) || !Number.isSafeInteger(totalPages)) return undefined;
  if (currentPage < 1 || totalPages < 1 || currentPage >= totalPages) return undefined;
  return currentPage + 1;
}

/** Preserve stable order across pages even when a boundary row appears twice. */
export function uniqueAssignments<T extends { id: string }>(
  pages: readonly { data: readonly T[] }[],
): T[] {
  const seen = new Set<string>();
  return pages.flatMap((page) =>
    page.data.filter((assignment) => {
      if (seen.has(assignment.id)) return false;
      seen.add(assignment.id);
      return true;
    }),
  );
}
