#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
image='redis:8-alpine@sha256:7958cfbb9d152f87dadfbc89f1b0b15938f0b81ff8982feb327476f4911935c3'
docker run --rm --network none --read-only --user redis \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --cpus 2 --pids-limit 64 \
  --tmpfs /tmp:rw,nosuid,nodev,size=96m,mode=1777 \
  --tmpfs /data:rw,nosuid,nodev,size=8m,mode=0700,uid=999,gid=1000 \
  --mount "type=bind,src=$root/fixture.sh,dst=/fixture.sh,readonly" \
  --mount "type=bind,src=$root/redis.conf.fixture,dst=/fixture.conf,readonly" \
  --entrypoint sh "$image" /fixture.sh
