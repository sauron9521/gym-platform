import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.ADMIN_E2E_API_PORT ?? 3311);
const adminOrigin = 'http://localhost:3310';
const adminCookie = '__Host-admin-sid';
const regularCookie = '__Host-sid';
const sessions = new Map();

const send = (response, status, body = null, headers = {}) => {
  const meta = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers };
  if (body === null) {
    response.writeHead(status, meta);
    response.end();
  } else {
    response.writeHead(status, { ...meta, 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  }
};

const cookie = (request, name) => {
  const header = request.headers.cookie ?? '';
  const pair = header
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='));
  return pair ? pair.slice(name.length + 1) : undefined;
};
const setAdmin = (token) =>
  [adminCookie + '=' + token, 'Path=/', 'Max-Age=900', 'Secure', 'HttpOnly', 'SameSite=Lax'].join(
    '; ',
  );
const clearAdmin = () =>
  [adminCookie + '=', 'Path=/', 'Max-Age=0', 'Secure', 'HttpOnly', 'SameSite=Lax'].join('; ');

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  if (path === '/__health') return send(response, 200, { status: 'ok' });
  if (path === '/health/ready') return send(response, 200, { status: 'ok' });

  if (request.method === 'POST' && path === '/auth/login') {
    return send(
      response,
      200,
      { mfaRequired: false },
      {
        'set-cookie':
          regularCookie + '=ordinary-test-token; Path=/; Secure; HttpOnly; SameSite=Lax',
      },
    );
  }

  if (request.method === 'POST' && path === '/auth/admin-login') {
    if (request.headers.origin && request.headers.origin !== adminOrigin) {
      return send(response, 403, { message: 'Untrusted origin' });
    }
    let body;
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return send(response, 400, { message: 'Invalid body' });
    }
    if (
      body.password !== 'FixturePassword123!' ||
      !['admin@example.test', 'pending@example.test'].includes(body.email)
    ) {
      return send(response, 401, { message: 'Invalid credentials' });
    }
    const token = randomUUID();
    const pending = body.email === 'pending@example.test';
    sessions.set(token, { owner: body.email, pending });
    return send(response, 200, { mfaRequired: pending }, { 'set-cookie': setAdmin(token) });
  }

  const token = cookie(request, adminCookie);
  const session = sessions.get(token);
  if (request.method === 'GET' && path === '/auth/admin-session') {
    if (!session || session.pending) return send(response, 401, { message: 'Unauthorized' });
    return send(response, 200, { id: '00000000-0000-4000-8000-000000000009', role: 'ADMIN' });
  }

  if (request.method === 'POST' && path === '/auth/admin-sign-out') {
    if (!session) return send(response, 401, { message: 'Unauthorized' });
    sessions.delete(token);
    return send(response, 204, null, { 'set-cookie': clearAdmin() });
  }

  if (request.method === 'POST' && path === '/auth/admin-sessions/revoke-all') {
    if (!session || session.pending) return send(response, 401, { message: 'Unauthorized' });
    for (const [key, other] of sessions) {
      if (other.owner === session.owner) sessions.delete(key);
    }
    return send(response, 204, null, { 'set-cookie': clearAdmin() });
  }

  if (request.method === 'GET' && path === '/users/me') {
    if (cookie(request, regularCookie) === 'ordinary-test-token') {
      return send(response, 200, { id: 'ordinary-user', role: 'ADMIN' });
    }
    return send(response, 401, { message: 'Unauthorized' });
  }
  return send(response, 404, { message: 'Not found' });
});
server.listen(port, '127.0.0.1');
