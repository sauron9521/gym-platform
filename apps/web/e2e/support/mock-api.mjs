import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const host = '127.0.0.1';
const port = Number(process.env.E2E_API_PORT ?? 3101);
const cookieName = 'gym_e2e_session';
const password = 'TestPassword123!';
const sessions = new Map();

const accounts = {
  'athlete@example.test': {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'athlete@example.test',
    role: 'ATHLETE',
    displayName: 'Тестовий атлет',
  },
  'locale@example.test': {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'locale@example.test',
    role: 'ATHLETE',
    displayName: 'Локаль тест',
    preferredLocale: null,
  },
  'locale-error@example.test': {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'locale-error@example.test',
    role: 'ATHLETE',
    displayName: 'Локаль помилка',
    preferredLocale: null,
  },
  // Keep locale-testing state separate from the shared athlete used by WCAG/auth E2E.
  'workouts-i18n@example.test': {
    id: '00000000-0000-4000-8000-000000000005',
    email: 'workouts-i18n@example.test',
    role: 'ATHLETE',
    displayName: 'Workouts Locale QA',
    preferredLocale: null,
  },
  // Dedicated identity for WCAG scenarios: other specs must not affect its saved locale.
  'wcag@example.test': {
    id: '00000000-0000-4000-8000-000000000006',
    email: 'wcag@example.test',
    role: 'ATHLETE',
    displayName: 'WCAG QA',
    preferredLocale: null,
  },
  'trainer@example.test': {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'trainer@example.test',
    role: 'TRAINER',
    displayName: 'Тестовий тренер',
  },
};

const workouts = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Жим лежачи',
    status: 'PLANNED',
    scheduledAt: '2026-11-15T10:00:00.000Z',
    exerciseCount: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    title: 'Присідання',
    status: 'COMPLETED',
    scheduledAt: '2026-11-10T10:00:00.000Z',
    exerciseCount: 3,
  },
];

function send(response, status, data, extraHeaders = {}) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(data === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }),
    ...extraHeaders,
  });
  response.end(data === undefined ? undefined : JSON.stringify(data));
}

function getSession(request) {
  const cookies = (request.headers.cookie ?? '').split(';').map((item) => item.trim());
  const value = cookies.find((item) => item.startsWith(cookieName + '='));
  return value ? sessions.get(value.slice(cookieName.length + 1)) : undefined;
}

async function readBody(request) {
  let data = '';
  for await (const chunk of request) {
    data += chunk;
    if (data.length > 4096) throw new Error('Request too large');
  }
  return JSON.parse(data || '{}');
}

function accountResponse(session) {
  const { account, profile } = session;
  return {
    id: account.id,
    email: account.email,
    emailVerified: true,
    role: account.role,
    preferredLocale: account.preferredLocale ?? null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    profile,
  };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const route = url.pathname;
    if (request.method === 'GET' && route === '/__health') {
      return send(response, 200, { status: 'ready' });
    }

    if (request.method === 'POST' && route === '/auth/login') {
      const body = await readBody(request);
      const account = accounts[body.email];
      if (!account || body.password !== password) {
        return send(response, 401, { message: 'Invalid credentials' });
      }

      const token = randomUUID();
      sessions.set(token, {
        account,
        profile: {
          firstName: account.role === 'ATHLETE' ? 'Тестовий' : 'Тренер',
          lastName: account.role === 'ATHLETE' ? 'Атлет' : 'Тестовий',
          displayName: account.displayName,
          birthday: null,
          height: 193,
          weight: 81.5,
          timezone: 'Europe/Kyiv',
          avatarUrl: null,
        },
      });
      return send(
        response,
        200,
        { mfaRequired: false },
        { 'set-cookie': cookieName + '=' + token + '; HttpOnly; Path=/; SameSite=Lax' },
      );
    }

    const session = getSession(request);
    if (request.method === 'POST' && route === '/auth/sign-out') {
      const token = (request.headers.cookie ?? '')
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(cookieName + '='));
      if (token) sessions.delete(token.slice(cookieName.length + 1));
      return send(response, 204, undefined, {
        'set-cookie': cookieName + '=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
      });
    }

    if (!session) return send(response, 401, { message: 'Unauthenticated' });

    if (request.method === 'GET' && route === '/users/me') {
      return send(response, 200, accountResponse(session));
    }

    // Match the live persisted-capability policy: a legacy TRAINER without a
    // profile is BOTH a trainer and an athlete. The fixture has no moderator
    // profile state; real approval/revocation is exercised by PostgreSQL E2E.
    if (request.method === 'GET' && route === '/users/me/capabilities') {
      return send(response, 200, {
        athlete: true,
        trainer: session.account.role === 'TRAINER',
        admin: false,
      });
    }

    if (request.method === 'PATCH' && route === '/users/me/preferences') {
      const body = await readBody(request);
      if (
        Object.keys(body).length !== 1 ||
        !Object.hasOwn(body, 'preferredLocale') ||
        !['uk', 'en', null].includes(body.preferredLocale)
      ) {
        return send(response, 400, { message: 'Invalid locale preference' });
      }
      session.account.preferredLocale = body.preferredLocale;
      return send(response, 200, accountResponse(session));
    }

    if (request.method === 'PATCH' && route === '/users/me') {
      const body = await readBody(request);
      for (const field of [
        'firstName',
        'lastName',
        'displayName',
        'birthday',
        'height',
        'weight',
        'timezone',
      ]) {
        if (Object.hasOwn(body, field)) session.profile[field] = body[field];
      }
      return send(response, 200);
    }

    if (request.method === 'GET' && route === '/workouts') {
      // Personal workouts remain an Athlete feature for legacy trainers too.
      // This fixture only includes non-admin authenticated identities.
      const matching = workouts.filter(
        (workout) =>
          !url.searchParams.has('status') || workout.status === url.searchParams.get('status'),
      );
      const page = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 10);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
        return send(response, 400, { message: 'Bad pagination' });
      }
      return send(response, 200, {
        data: matching.slice((page - 1) * limit, page * limit),
        meta: {
          total: matching.length,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(matching.length / limit)),
        },
      });
    }

    if (request.method === 'GET' && route === '/training-programs') {
      if (session.account.role !== 'TRAINER') {
        return send(response, 403, { message: 'Forbidden' });
      }
      return send(response, 200, {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
      });
    }

    return send(response, 404, { message: 'Test fixture route not implemented' });
  } catch {
    return send(response, 400, { message: 'Invalid request' });
  }
});

server.listen(port, host, () => {
  console.log('[web-e2e] Loopback-only fixture API ready');
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
