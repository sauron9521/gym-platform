#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
cp "$root/Dockerfile" "$work/"
docker build --platform linux/amd64 --iidfile "$work/image-id" "$work"
docker run --rm --network none --read-only --user postgres \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 768m --cpus 2 --pids-limit 128 --shm-size 64m \
  --tmpfs /tmp:rw,nosuid,nodev,size=384m,mode=1777 \
  --tmpfs /repo:rw,nosuid,nodev,size=128m,mode=0700,uid=70,gid=70 \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=8m,mode=0700,uid=70,gid=70 \
  --mount "type=bind,src=$root/fixture.sh,dst=/fixture.sh,readonly" \
  --entrypoint sh "$(cat "$work/image-id")" /fixture.sh
