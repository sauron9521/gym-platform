#!/usr/bin/env bash
# Isolated native PostgreSQL PITR rehearsal; no host volumes, network or credentials.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
image='postgres:17-alpine@sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32'
docker run --rm --network none --read-only --user postgres \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 768m --cpus 2 --pids-limit 128 --shm-size 64m \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m,mode=1777 \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=8m,mode=0700,uid=70,gid=70 \
  --mount "type=bind,src=$root/pitr-fixture.sh,dst=/fixture.sh,readonly" \
  --entrypoint sh "$image" /fixture.sh
