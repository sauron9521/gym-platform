#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
ids=()
cleanup() {
  for ((i=${#ids[@]}-1; i>=0; i--)); do
    docker rm -fv "${ids[i]}" >/dev/null 2>&1 || true
  done
  rm -rf -- "$work"
}
trap cleanup EXIT
trap 'exit 1' INT TERM
am='prom/alertmanager:v0.28.1@sha256:27c475db5fb156cab31d5c18a4251ac7ed567746a2483ff264516437a39b15ba'
prom='prom/prometheus:v3.16.0@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06'
node='node:24-trixie-slim@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5'
# Accelerate group evaluation only; keep the actual existing rules and expressions.
sed 's/interval: 30s/interval: 2s/g' "$root/../alerts.rules.yml" > "$work/alerts.rules.yml"
cp "$root/"{alertmanager.fixture.yml,prometheus.fixture.yml,sinks.fixture.cjs,assert.fixture.cjs} "$work/"
chmod 755 "$work"
chmod 644 "$work/"*
common=(--read-only --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges --memory 256m --cpus 1 --pids-limit 128)
mount=(--mount "type=bind,src=$work,dst=/fixture,readonly")
docker run --rm --network none "${common[@]}" "${mount[@]}" --entrypoint /bin/amtool "$am" check-config /fixture/alertmanager.fixture.yml
docker run --rm --network none "${common[@]}" "${mount[@]}" --entrypoint /bin/promtool "$prom" check config /fixture/prometheus.fixture.yml
sink="$(docker run -d --network none "${common[@]}" "${mount[@]}" --entrypoint node "$node" /fixture/sinks.fixture.cjs)"
ids+=("$sink")
ids+=("$(docker run -d --network "container:$sink" "${common[@]}" "${mount[@]}" --tmpfs /alertmanager:rw,nosuid,nodev,size=16m,mode=0700,uid=65534,gid=65534 "$am" --config.file=/fixture/alertmanager.fixture.yml --storage.path=/alertmanager --web.listen-address=127.0.0.1:9093 --cluster.listen-address=)")
ids+=("$(docker run -d --network "container:$sink" "${common[@]}" "${mount[@]}" --tmpfs /prometheus:rw,nosuid,nodev,size=64m,mode=0700,uid=65534,gid=65534 "$prom" --config.file=/fixture/prometheus.fixture.yml --storage.tsdb.path=/prometheus --web.listen-address=127.0.0.1:9090)")
if ! docker exec "$sink" node /fixture/assert.fixture.cjs; then
  for id in "${ids[@]}"; do docker logs --tail 35 "$id" >&2 || true; done
  exit 1
fi
