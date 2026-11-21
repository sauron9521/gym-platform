import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import {
  UsersTable,
  type DirectoryCopy,
  type UserDirectoryRow,
} from '../../src/features/users/ui/users-table';

const copy: DirectoryCopy = {
  search: 'Search by email',
  allRoles: 'All roles',
  allStatuses: 'All statuses',
  email: 'Email',
  role: 'Role',
  status: 'Status',
  joined: 'Registration date',
  athlete: 'Athlete',
  trainer: 'Trainer',
  admin: 'Administrator',
  active: 'Active',
  suspended: 'Suspended',
  sortEmail: 'Sort by email',
  sortJoined: 'Sort by registration date',
  unavailableTitle: 'User directory unavailable',
  unavailableDescription: 'Protected endpoint is not connected',
  emptyTitle: 'No users match',
  emptyDescription: 'Change filters',
  page: 'Page',
  of: 'of',
  previous: 'Previous',
  next: 'Next',
  rows: 'records',
};

const rows: UserDirectoryRow[] = [
  {
    id: 'a',
    email: 'zoe@example.test',
    role: 'ATHLETE',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'b',
    email: 'adam@example.test',
    role: 'TRAINER',
    status: 'ACTIVE',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'c',
    email: 'bea@example.test',
    role: 'ADMIN',
    status: 'SUSPENDED',
    createdAt: '2026-03-01T00:00:00Z',
  },
];

afterEach(cleanup);

describe('UsersTable read-only UI contract', () => {
  test('fails closed without a source, disabling controls and showing no rows or guessed totals', () => {
    const { container } = render(
      <UsersTable rows={rows} available={false} locale="en" copy={copy} />,
    );
    expect(screen.getByRole('alert').textContent).toContain('User directory unavailable');
    expect(screen.getByRole('searchbox')).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('combobox').every((x) => x.hasAttribute('disabled'))).toBe(true);
    expect(screen.queryByText('zoe@example.test')).toBeNull();
    expect(screen.queryByText('3 records')).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
  });

  test('filters by email, role and status without exposing unrelated records', () => {
    render(<UsersTable rows={rows} available locale="en" copy={copy} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'EXAMPLE.TEST' } });
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: 'TRAINER' },
    });
    expect(screen.getByText('adam@example.test')).toBeTruthy();
    expect(screen.queryByText('zoe@example.test')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'SUSPENDED' },
    });
    expect(screen.getByText('No users match')).toBeTruthy();
    expect(screen.getByText('0 records')).toBeTruthy();
  });

  test('sorts email and dates, with stable pagination and reset on filter', () => {
    const many: UserDirectoryRow[] = Array.from({ length: 13 }, (_, index) => ({
      id: String(index),
      email: `member${String(index).padStart(2, '0')}@example.test`,
      role: 'ATHLETE',
      status: 'ACTIVE',
      createdAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    render(<UsersTable rows={many} available locale="en" copy={copy} />);
    expect(screen.getByText('member12@example.test')).toBeTruthy();
    expect(screen.queryByText('member00@example.test')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('member00@example.test')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by email' }));
    expect(screen.getByText('member00@example.test')).toBeTruthy();
    expect(screen.queryByText('member12@example.test')).toBeNull();
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'member12' } });
    expect(screen.getByText('member12@example.test')).toBeTruthy();
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
  });
});
