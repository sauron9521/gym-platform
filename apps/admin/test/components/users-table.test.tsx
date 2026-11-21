import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { UsersTable, type DirectoryCopy } from '../../src/features/users/ui/users-table';

const copy: DirectoryCopy = {
  search: 'Search by email',
  allRoles: 'All roles',
  email: 'Email',
  role: 'Role',
  status: 'Status',
  joined: 'Registration date',
  athlete: 'Athlete',
  trainer: 'Trainer',
  admin: 'Administrator',
  active: 'Active',
  unavailableTitle: 'Directory unavailable',
  unavailableDescription: 'Check API availability',
  forbiddenTitle: 'Insufficient permissions',
  forbiddenDescription: 'Super Admin required',
  invalidTitle: 'Invalid filters',
  invalidDescription: 'Reset filters',
  expiredTitle: 'Session expired',
  expiredDescription: 'Sign in',
  emptyTitle: 'No users match',
  emptyDescription: 'Change filters',
  page: 'Page',
  of: 'of',
  previous: 'Previous',
  next: 'Next',
  rows: 'records',
  apply: 'Apply filters',
  clear: 'Clear filters',
  newestFirst: 'Newest first',
};

const filters = { page: 2, search: 'email', role: 'TRAINER' as const };
const data = [
  {
    id: 'f09d7567-626e-45d8-99f1-829ce4204fbd',
    email: 'coach@email.test',
    role: 'TRAINER' as const,
    status: 'ACTIVE' as const,
    createdAt: '2026-11-22T10:00:00Z',
  },
];
const ready = {
  kind: 'ready' as const,
  data,
  meta: { total: 21, skip: 20, take: 20, totalPages: 2 },
};

afterEach(cleanup);

describe('Admin UsersTable with server-driven data', () => {
  test('renders only upstream page, backend total and URL-preserved pagination', () => {
    const { container } = render(
      <UsersTable result={ready} filters={filters} locale="en" copy={copy} />,
    );
    expect(screen.getByText('coach@email.test')).toBeTruthy();
    expect(screen.getByText('21 records')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    const previous = screen.getByRole('link', { name: 'Previous' });
    expect(previous.getAttribute('href')).toBe('/users?search=email&role=TRAINER');
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
    expect(screen.getByText('Newest first')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sort/ })).toBeNull();
  });

  test('uses a normal GET form for API-side email and role filtering, not current-page state', () => {
    const { container } = render(
      <UsersTable result={ready} filters={filters} locale="en" copy={copy} />,
    );
    const form = container.querySelector('form');
    expect(form?.getAttribute('method')).toBe('get');
    expect(form?.getAttribute('action')).toBe('/users');
    expect(screen.getByRole('searchbox')).toHaveProperty('value', 'email');
    expect(screen.getByRole('searchbox').getAttribute('name')).toBe('search');
    expect(screen.getByRole('searchbox').getAttribute('minlength')).toBe('2');
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveProperty('value', 'TRAINER');
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe('/users');
  });

  test.each([
    ['forbidden', 'Insufficient permissions'],
    ['unavailable', 'Directory unavailable'],
    ['unauthenticated', 'Session expired'],
    ['invalid', 'Invalid filters'],
  ] as const)('fails closed on %s without records, count or active filters', (kind, notice) => {
    const { container } = render(
      <UsersTable result={{ kind }} filters={filters} locale="en" copy={copy} />,
    );
    expect(screen.getByRole('alert').textContent).toContain(notice);
    expect(screen.getByRole('searchbox')).toHaveProperty('disabled', true);
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true);
    expect(screen.queryByText('coach@email.test')).toBeNull();
    expect(screen.queryByText('21 records')).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Apply filters' })).toBeNull();
  });

  test('shows safe empty state without invented records or numbers', () => {
    render(
      <UsersTable
        result={{ kind: 'ready', data: [], meta: { total: 0, skip: 0, take: 20, totalPages: 0 } }}
        filters={{ page: 1, search: '', role: '' }}
        locale="en"
        copy={copy}
      />,
    );
    expect(screen.getByText('No users match')).toBeTruthy();
    expect(screen.getByText('0 records')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1);
  });
});
