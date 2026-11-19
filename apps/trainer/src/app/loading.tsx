export default function Loading() {
  return (
    <div aria-busy="true" role="status" className="max-w-3xl animate-pulse space-y-4">
      <div className="h-6 w-40 rounded-lg bg-muted" />
      <div className="h-12 max-w-xl rounded-lg bg-muted" />
      <div className="h-28 rounded-xl bg-muted" />
      <span className="sr-only">Loading / Завантаження</span>
    </div>
  );
}
