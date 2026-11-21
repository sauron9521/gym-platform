'use client';

import { useMemo, useState } from 'react';

export type UserDirectoryRow = {
  id: string;
  email: string;
  role: 'ATHLETE' | 'TRAINER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
};

export type DirectoryCopy = {
  search: string;
  allRoles: string;
  allStatuses: string;
  email: string;
  role: string;
  status: string;
  joined: string;
  athlete: string;
  trainer: string;
  admin: string;
  active: string;
  suspended: string;
  sortEmail: string;
  sortJoined: string;
  unavailableTitle: string;
  unavailableDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  page: string;
  of: string;
  previous: string;
  next: string;
  rows: string;
};

const PAGE_SIZE = 10;

export function UsersTable({
  rows,
  available,
  locale,
  copy,
}: {
  rows: readonly UserDirectoryRow[];
  available: boolean;
  locale: 'uk' | 'en';
  copy: DirectoryCopy;
}) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [order, setOrder] = useState<'recent' | 'oldest' | 'email'>('recent');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!available) return [];
    const query = search.trim().toLocaleLowerCase(locale);
    return rows
      .filter(
        (user) =>
          (query === '' || user.email.toLocaleLowerCase(locale).includes(query)) &&
          (role === 'all' || user.role === role) &&
          (status === 'all' || user.status === status),
      )
      .sort((a, b) =>
        order === 'email'
          ? a.email.localeCompare(b.email, locale) || a.id.localeCompare(b.id)
          : (order === 'recent'
              ? b.createdAt.localeCompare(a.createdAt)
              : a.createdAt.localeCompare(b.createdAt)) || a.id.localeCompare(b.id),
      );
  }, [available, rows, search, role, status, order, locale]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const roleLabels = { ATHLETE: copy.athlete, TRAINER: copy.trainer, ADMIN: copy.admin };
  const statusLabels = { ACTIVE: copy.active, SUSPENDED: copy.suspended };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <label className="space-y-1.5 text-sm font-medium">
          <span>{copy.search}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            disabled={!available}
            placeholder={copy.search}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>{copy.role}</span>
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            disabled={!available}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="all">{copy.allRoles}</option>
            <option value="ATHLETE">{copy.athlete}</option>
            <option value="TRAINER">{copy.trainer}</option>
            <option value="ADMIN">{copy.admin}</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>{copy.status}</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            disabled={!available}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="all">{copy.allStatuses}</option>
            <option value="ACTIVE">{copy.active}</option>
            <option value="SUSPENDED">{copy.suspended}</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs tracking-wide text-muted-foreground">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 font-semibold"
                aria-sort={order === 'email' ? 'ascending' : 'none'}
              >
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    setOrder('email');
                    setPage(1);
                  }}
                  className="rounded text-left font-semibold enabled:hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={copy.sortEmail}
                >
                  {copy.email}
                </button>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {copy.role}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {copy.status}
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-semibold"
                aria-sort={
                  order === 'recent' ? 'descending' : order === 'oldest' ? 'ascending' : 'none'
                }
              >
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    setOrder((current) => (current === 'recent' ? 'oldest' : 'recent'));
                    setPage(1);
                  }}
                  className="rounded text-left font-semibold enabled:hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={copy.sortJoined}
                >
                  {copy.joined}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-medium">{user.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{roleLabels[user.role]}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                    {statusLabels[user.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {Number.isNaN(Date.parse(user.createdAt))
                    ? '—'
                    : new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(new Date(user.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="space-y-2 px-5 py-12 text-center" role={available ? 'status' : 'alert'}>
            <p className="font-semibold">{available ? copy.emptyTitle : copy.unavailableTitle}</p>
            <p className="mx-auto max-w-lg text-sm text-muted-foreground">
              {available ? copy.emptyDescription : copy.unavailableDescription}
            </p>
          </div>
        )}
      </div>

      {available && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="status" className="text-muted-foreground">
            {filtered.length} {copy.rows}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-border px-3 py-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {copy.previous}
            </button>
            <span aria-live="polite">
              {copy.page} {currentPage} {copy.of} {pages}
            </span>
            <button
              type="button"
              disabled={currentPage >= pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              className="rounded-lg border border-border px-3 py-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {copy.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
