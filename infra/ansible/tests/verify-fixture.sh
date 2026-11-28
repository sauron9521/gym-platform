#!/usr/bin/env bash
set -euo pipefail
cd /fixture
ansible --version
for environment in staging production; do
  ansible-inventory -i "inventories/$environment/hosts.yml" --list |
    python -c 'import json,sys; data=json.load(sys.stdin); assert data["_meta"]["hostvars"] == {}; assert all(not x.get("hosts") for x in data.values() if isinstance(x,dict))'
done
play=(ansible-playbook -i /fixture/tests/hosts.yml playbooks/fixture.yml)
"${play[@]}" --syntax-check
"${play[@]}" -e '{"fixture_expected_change":true}'
"${play[@]}" -e '{"fixture_expected_change":false}'
"${play[@]}" --check -e '{"fixture_expected_change":false}'
# Negative test: a mismatched environment must fail before file operations.
if "${play[@]}" --limit staging-fixture -e '{"ovranto_environment":"production","fixture_expected_change":false}' >/tmp/negative.log 2>&1; then
  echo 'Unexpected acceptance of mismatched fixture' >&2
  exit 1
fi
grep -q 'INF03 fixture-only target required.' /tmp/negative.log
python - <<'PY'
from pathlib import Path
import json
import stat

root = Path('/tmp/ovranto-ansible-fixture')
assert {p.name for p in root.iterdir()} == {'staging', 'production'}
for env in ('staging', 'production'):
    directory = root / env
    for path, mode in {
        '.': 0o700, 'opt/ovranto': 0o750, 'etc/ovranto': 0o700,
        'var/lib/ovranto': 0o700, 'var/lib/ovranto/media': 0o700,
        'etc/ovranto/environment.json': 0o600,
    }.items():
        assert stat.S_IMODE((directory / path).stat().st_mode) == mode, path
    assert json.loads((directory / 'etc/ovranto/environment.json').read_text()) == {
        'environment': env, 'schemaVersion': 1, 'fixtureOnly': True,
    }
print('Ansible foundation PASS: empty real inventories, two isolated fixtures, modes, idempotence, check mode and rejected mismatched target.')
PY
