#!/usr/bin/env bash
# No real inventory or host mutation; network only for pinned dependency build.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/build" "$work/fixture/inventories/staging" "$work/fixture/inventories/production" "$work/fixture/roles/host_layout/tasks" "$work/fixture/playbooks" "$work/fixture/tests"
cp "$root/Dockerfile" "$root/requirements.lock" "$work/build/"
cp "$root/ansible.cfg" "$work/fixture/"
for environment in staging production; do
  cp "$root/inventories/$environment/hosts.yml" "$work/fixture/inventories/$environment/"
done
cp "$root/roles/host_layout/tasks/main.yml" "$work/fixture/roles/host_layout/tasks/"
cp "$root/playbooks/fixture.yml" "$work/fixture/playbooks/"
cp "$root/tests/hosts.yml" "$root/tests/verify-fixture.sh" "$work/fixture/tests/"
mkdir -p "$work/fixture/roles/staging_bundle/tasks" "$work/fixture/sources"
cp "$root/roles/staging_bundle/tasks/main.yml" "$work/fixture/roles/staging_bundle/tasks/"
cp "$root/playbooks/staging-bundle.yml" "$work/fixture/playbooks/"
cp "$root/tests/verify-staging-bundle.sh" "$work/fixture/tests/"
cp "$root/../security/sshd_config.candidate" "$root/../proxy/Caddyfile.staging" "$root/../proxy/staging.env.example" "$work/fixture/sources/"
cp "$root/../services/docker-daemon.candidate.json" "$root/../services/ovranto-staging-edge.service" "$work/fixture/sources/"
chmod 755 "$work/fixture"
docker build --platform linux/amd64 --iidfile "$work/image-id" "$work/build"
docker run --rm --platform linux/amd64 --network none --read-only \
  --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,nodev,size=128m,mode=1777 \
  --mount "type=bind,src=$work/fixture,dst=/fixture,readonly" \
  --env ANSIBLE_CONFIG=/fixture/ansible.cfg \
  "$(cat "$work/image-id")" bash -ec 'bash /fixture/tests/verify-fixture.sh && bash /fixture/tests/verify-staging-bundle.sh'
