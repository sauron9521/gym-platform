const http = require('node:http');

let active = false;
let secondaryAvailable = false;
const receipts = [];
function respond(res, status, body = '') {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}
http
  .createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(
        'gym_api_docker_oom_killed ' +
          Number(active) +
          '\ngym_api_monitor_redis_outages_window_5m ' +
          Number(active) +
          '\n',
      );
    } else if (req.method === 'POST' && req.url === '/activate') {
      active = true;
      respond(res, 200);
    } else if (req.method === 'POST' && req.url === '/recover-receiver') {
      secondaryAvailable = true;
      respond(res, 200);
    } else if (req.method === 'POST' && req.url === '/resolve') {
      active = false;
      respond(res, 200);
    } else if (req.method === 'GET' && req.url === '/receipts') {
      respond(res, 200, JSON.stringify(receipts));
    } else respond(res, 404);
  })
  .listen(18080, '127.0.0.1');

for (const [receiver, port] of [
  ['primary-fixture', 18081],
  ['secondary-fixture', 18082],
]) {
  http
    .createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/alerts') return respond(res, 404);
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 65536) req.destroy();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (payload.receiver !== receiver || !Array.isArray(payload.alerts))
            return respond(res, 400);
          const status = receiver === 'secondary-fixture' && !secondaryAvailable ? 503 : 200;
          receipts.push({
            receiver,
            status,
            alerts: payload.alerts.map((a) => ({
              name: a.labels.alertname,
              severity: a.labels.severity,
              status: a.status,
              fingerprint: a.fingerprint,
            })),
          });
          respond(res, status);
        } catch {
          respond(res, 400);
        }
      });
    })
    .listen(port, '127.0.0.1');
}
