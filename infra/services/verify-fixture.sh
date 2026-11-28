#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 65534
test ! -S /run/docker.sock
test ! -e /etc/ovranto/staging/edge-approved
systemd-analyze --version
# Parse the actual unit with the installed package units and their dependencies.
systemd-analyze verify --man=no --generators=no /fixture/ovranto-staging-edge.service
# Confirm the required binaries exist; never launch their daemons.
dockerd --validate --config-file /fixture/docker-daemon.candidate.json
jq -e '. == {"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"},"log-level":"info"}' /fixture/docker-daemon.candidate.json
caddy validate --config /fixture/Caddyfile --adapter caddyfile
caddy adapt --config /fixture/Caddyfile --adapter caddyfile > /tmp/caddy.json
jq -e '.admin.disabled == true and ([.apps.http.servers[].listen[]] | sort == ["127.0.0.1:443","127.0.0.1:80"])' /tmp/caddy.json
# Negative tests must reach real parsers, not merely fail on missing files.
printf '{"not-a-docker-option":true}\n' > /tmp/invalid-daemon.json
if dockerd --validate --config-file /tmp/invalid-daemon.json; then
  echo 'Unexpected acceptance of invalid Docker configuration' >&2; exit 1
fi
sed 's@^ExecStart=/usr/bin/caddy .*@ExecStart=/nonexistent/ovranto-caddy@' /fixture/ovranto-staging-edge.service > /tmp/invalid-edge.service
if systemd-analyze verify --man=no --generators=no /tmp/invalid-edge.service; then
  echo 'Unexpected acceptance of invalid service executable' >&2; exit 1
fi
grep -Fx 'Requisite=docker.service' /fixture/ovranto-staging-edge.service
grep -Fx 'After=docker.service' /fixture/ovranto-staging-edge.service
grep -Fx 'AssertPathExists=/etc/ovranto/staging/edge-approved' /fixture/ovranto-staging-edge.service
grep -Fx 'User=caddy' /fixture/ovranto-staging-edge.service
grep -Fx 'CapabilityBoundingSet=CAP_NET_BIND_SERVICE' /fixture/ovranto-staging-edge.service
grep -Fx 'IPAddressDeny=any' /fixture/ovranto-staging-edge.service
grep -Fx 'IPAddressAllow=localhost' /fixture/ovranto-staging-edge.service
if grep -Eq '^\[Install\]|^ExecReload=' /fixture/ovranto-staging-edge.service; then
  echo 'Unexpected enablement or admin-API reload policy' >&2; exit 1
fi
echo 'Service contract PASS: Ubuntu systemd parser, Docker daemon configuration, loopback-only Caddy, negative parser checks. No service activation.'
