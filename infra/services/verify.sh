#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/build" "$work/fixture"
cp "$root/bootstrap"/{Dockerfile,docker.sources,caddy.sources,install-candidate.sh,vendor-packages.lock,vendor.pref} "$work/build/"
cp "$root/services"/{ovranto-staging-edge.service,docker-daemon.candidate.json,verify-fixture.sh} "$work/fixture/"
cp "$root/proxy/Caddyfile.staging" "$work/fixture/Caddyfile"
docker build --platform linux/amd64 --target service-validation --iidfile "$work/image-id" "$work/build"
docker run --rm --platform linux/amd64 --network none --read-only \
  --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --cpus 1 --pids-limit 64 \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m,mode=1777 \
  --mount "type=bind,src=$work/fixture,dst=/fixture,readonly" \
  --env HOME=/tmp --env XDG_DATA_HOME=/tmp/caddy-data --env XDG_CONFIG_HOME=/tmp/caddy-config \
  "$(cat "$work/image-id")" bash /fixture/verify-fixture.sh
