export function nextAssignmentPage(currentPage: number, totalPages: number): number | undefined {
  return Number.isInteger(currentPage) && currentPage > 0 && currentPage < totalPages
    ? currentPage + 1
    : undefined;
}
