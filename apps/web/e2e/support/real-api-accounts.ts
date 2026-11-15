import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, type Page } from '@playwright/test';

export const origin = 'http://127.0.0.1:3200';
const password = 'BrowserTest123!';

// Resolve the database driver from the API workspace. The Web app gains no
// runtime dependency and this file only executes against a disposable test DB.
const requireApi = createRequire(new URL('../../../api/package.json', import.meta.url));
export type DisposableDatabaseClient = {
  query(
    sql: string,
    values: string[],
  ): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
};

const { Client } = requireApi('pg') as {
  Client: new (options: { connectionString: string }) => DisposableDatabaseClient & {
    connect(): Promise<void>;
    end(): Promise<void>;
  };
};

function disposableDatabaseUrl(): string {
  const database = process.env.TEST_DATABASE_URL;
  if (!database || database !== process.env.DATABASE_URL) {
    throw new Error('Role fixtures require identical DATABASE_URL and TEST_DATABASE_URL');
  }
  const url = new URL(database);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !decodeURIComponent(url.pathname).endsWith('_test')
  ) {
    throw new Error('Role fixtures require a disposable loopback *_test database');
  }
  return database;
}

export async function register(page: Page, prefix: string) {
  const email = prefix + '-' + randomUUID() + '@example.test';
  await page.goto('/login');
  const registered = await page.request.post('/backend/auth/register', {
    data: { email, password },
    headers: { origin },
  });
  expect(registered.status()).toBe(201);

  const me = await page.request.get('/backend/users/me');
  expect(me.status()).toBe(200);
  const user: { id: string; role: string } = await me.json();
  expect(user.role).toBe('ATHLETE');
  await page.context().clearCookies();
  return { email, id: user.id };
}

export async function withDisposableDatabase<T>(
  run: (client: DisposableDatabaseClient) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: disposableDatabaseUrl() });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export async function promoteTestTrainer(userId: string) {
  await withDisposableDatabase(async (client) => {
    const result = await client.query(
      'UPDATE "users" SET "role" = $1 WHERE "id" = $2 AND "role" = $3',
      ['TRAINER', userId, 'ATHLETE'],
    );
    expect(result.rowCount).toBe(1);
  });
}

export async function login(page: Page, email: string, role: 'ATHLETE' | 'TRAINER') {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const response = await page.request.get('/backend/users/me');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ email, role });
}

export async function relationship(page: Page, id: string) {
  const result = await page.request.get('/backend/trainer-athletes/' + id);
  expect(result.status()).toBe(200);
  return result.json();
}
