#!/usr/bin/env bash
set -euo pipefail
cd /fixture
play=(ansible-playbook -i /fixture/tests/hosts.yml playbooks/staging-bundle.yml)
"${play[@]}" --syntax-check
staging=("${play[@]}" --limit staging-fixture)
first='{"bundle_expected_directory_change":true,"bundle_expected_file_changes":3,"bundle_expected_plan_change":true}'
unchanged='{"bundle_expected_directory_change":false,"bundle_expected_file_changes":0,"bundle_expected_plan_change":false}'
repair='{"bundle_expected_directory_change":false,"bundle_expected_file_changes":2,"bundle_expected_plan_change":false}'
base=/tmp/ovranto-ansible-fixture/staging/etc/ovranto
negative() {
  local expected="$1"; shift
  if "$@" >/tmp/staging-negative.log 2>&1; then
    echo 'Unexpected acceptance of staging bundle target' >&2; exit 1
  fi
  grep -q "$expected" /tmp/staging-negative.log
}
negative 'INF09a staging fixture only' "${play[@]}" --limit production-fixture -e "$first"
negative 'INF09a staging fixture only' "${staging[@]}" -e "$first" -e '{"ovranto_environment":"production"}'
test ! -e "$base/candidates"
cp "$base/environment.json" /tmp/staging-marker.original
printf '{"environment":"production","schemaVersion":1,"fixtureOnly":true}\n' > "$base/environment.json"
negative 'INF09a staging identity mismatch' "${staging[@]}" -e "$first"
test ! -e "$base/candidates"
cat /tmp/staging-marker.original > "$base/environment.json"
"${staging[@]}" -e "$first"
"${staging[@]}" -e "$unchanged"
"${staging[@]}" --check -e "$unchanged"
printf '\n# synthetic drift\n' >> "$base/candidates/Caddyfile.candidate"
chmod 0644 "$base/candidates/staging.env.example"
"${staging[@]}" --check -e "$repair"
grep -q 'synthetic drift' "$base/candidates/Caddyfile.candidate"
test "$(stat -c %a "$base/candidates/staging.env.example")" = 644
"${staging[@]}" -e "$repair"
"${staging[@]}" -e "$unchanged"
python - <<'PY'
from pathlib import Path
import json, stat
root = Path('/tmp/ovranto-ansible-fixture')
candidate = root / 'staging/etc/ovranto/candidates'
assert not (root / 'production/etc/ovranto/candidates').exists()
assert stat.S_IMODE(candidate.stat().st_mode) == 0o700
mapping = {'sshd_config.candidate': 'sshd_config.candidate', 'Caddyfile.candidate': 'Caddyfile.staging', 'staging.env.example': 'staging.env.example'}
assert {p.name for p in candidate.iterdir()} == set(mapping) | {'host-plan.json'}
for dest, source in mapping.items():
    assert (candidate / dest).read_bytes() == (Path('/fixture/sources') / source).read_bytes()
for p in candidate.iterdir():
    assert p.is_file() and not p.is_symlink()
    assert stat.S_IMODE(p.stat().st_mode) == 0o600, p
plan = json.loads((candidate / 'host-plan.json').read_text())
assert plan['environment'] == 'staging' and plan['fixtureOnly'] is True
assert plan['activationAuthorized'] is False and plan['publicIngressAuthorized'] is False
assert plan['target'] == {'distribution': 'Ubuntu', 'version': '24.04', 'architecture': 'amd64'}
env = dict(line.split('=',1) for line in (candidate/'staging.env.example').read_text().splitlines() if line and not line.startswith('#'))
assert set(plan['privateInputs']).isdisjoint(env)
assert env['NOTIFICATION_DISPATCH_ENABLED'] == env['HTTP_METRICS_ENABLED'] == 'false'
assert env['TRUSTED_PROXY_CIDRS'] == ''
assert env['SMTP_RECIPIENT_ALLOWLIST'] == 'fixture@example.test'
assert env['JWT_ISSUER'] == 'https://api-staging.ovranto.com'
print('INF09a staging candidate assembly PASS: exact canonical files, private modes, rejected production/mismatched marker, check-mode drift detection, repair and idempotence; no live activation.')
PY
