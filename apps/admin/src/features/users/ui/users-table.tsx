import Link from 'next/link';

import {
  directoryPageHref,
  type DirectoryFilters,
  type DirectoryResult,
} from '@/shared/api/admin-directory';

export type DirectoryCopy = {
  search: string;
  allRoles: string;
  email: string;
  role: string;
  status: string;
  joined: string;
  athlete: string;
  trainer: string;
  admin: string;
  active: string;
  unavailableTitle: string;
  unavailableDescription: string;
  forbiddenTitle: string;
  forbiddenDescription: string;
  invalidTitle: string;
  invalidDescription: string;
  expiredTitle: string;
  expiredDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  page: string;
  of: string;
  previous: string;
  next: string;
  rows: string;
  apply: string;
  clear: string;
  newestFirst: string;
  viewDetails: string;
};

const controlStyle =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function UsersTable({
  result,
  filters,
  locale,
  copy,
}: {
  result: DirectoryResult;
  filters: DirectoryFilters;
  locale: 'uk' | 'en';
  copy: DirectoryCopy;
}) {
  const available = result.kind === 'ready';
  const notices = {
    forbidden: [copy.forbiddenTitle, copy.forbiddenDescription],
    unavailable: [copy.unavailableTitle, copy.unavailableDescription],
    invalid: [copy.invalidTitle, copy.invalidDescription],
    unauthenticated: [copy.expiredTitle, copy.expiredDescription],
  } as const;

  return (
    <div className="space-y-5">
      <form action="/users" method="get" className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem]">
          <label className="space-y-1.5 text-sm font-medium">
            <span>{copy.search}</span>
            <input
              name="search"
              type="search"
              defaultValue={filters.search}
              disabled={!available}
              minLength={2}
              maxLength={100}
              placeholder={copy.search}
              className={controlStyle}
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>{copy.role}</span>
            <select
              name="role"
              defaultValue={filters.role}
              disabled={!available}
              className={controlStyle}
            >
              <option value="">{copy.allRoles}</option>
              <option value="ATHLETE">{copy.athlete}</option>
              <option value="TRAINER">{copy.trainer}</option>
              <option value="ADMIN">{copy.admin}</option>
            </select>
          </label>
        </div>
        {available && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {copy.apply}
            </button>
            <Link
              href="/users"
              className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {copy.clear}
            </Link>
            <span className="text-xs text-muted-foreground">{copy.newestFirst}</span>
          </div>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                {copy.email}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {copy.role}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {copy.status}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {copy.joined}
              </th>
            </tr>
          </thead>
          <tbody>
            {available &&
              result.data.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/users/${user.id}`}
                      prefetch={false}
                      aria-label={`${copy.viewDetails}: ${user.email}`}
                      className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {user.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {{ ATHLETE: copy.athlete, TRAINER: copy.trainer, ADMIN: copy.admin }[user.role]}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                      {copy.active}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
                      dateStyle: 'medium',
                      timeZone: 'UTC',
                    }).format(new Date(user.createdAt))}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!available && (
          <div className="space-y-2 px-5 py-12 text-center" role="alert">
            <p className="font-semibold">{notices[result.kind][0]}</p>
            <p className="mx-auto max-w-lg text-sm text-muted-foreground">
              {notices[result.kind][1]}
            </p>
          </div>
        )}
        {available && result.data.length === 0 && (
          <div className="space-y-2 px-5 py-12 text-center" role="status">
            <p className="font-semibold">{copy.emptyTitle}</p>
            <p className="mx-auto max-w-lg text-sm text-muted-foreground">
              {copy.emptyDescription}
            </p>
          </div>
        )}
      </div>

      {available && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="status" className="text-muted-foreground">
            {result.meta.total} {copy.rows}
          </p>
          <nav aria-label={copy.page} className="flex items-center gap-3">
            {filters.page > 1 ? (
              <Link
                href={directoryPageHref(filters, filters.page - 1)}
                className="rounded-lg border border-border px-3 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {copy.previous}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="rounded-lg border border-border px-3 py-2 opacity-50"
              >
                {copy.previous}
              </span>
            )}
            <span aria-live="polite">
              {copy.page} {filters.page} {copy.of} {Math.max(1, result.meta.totalPages)}
            </span>
            {filters.page < result.meta.totalPages ? (
              <Link
                href={directoryPageHref(filters, filters.page + 1)}
                className="rounded-lg border border-border px-3 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {copy.next}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="rounded-lg border border-border px-3 py-2 opacity-50"
              >
                {copy.next}
              </span>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
