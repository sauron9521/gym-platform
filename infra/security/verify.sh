#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/build" "$work/fixture"
cp "$root/Dockerfile" "$work/build/"
cp "$root/sshd_config.candidate" "$root/verify-sshd.sh" "$work/fixture/"
docker build --platform linux/amd64 --iidfile "$work/image-id" "$work/build"
docker run --rm --platform linux/amd64 --network none --read-only \
  --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /run:rw,nosuid,nodev,size=8m \
  --tmpfs /tmp:rw,nosuid,nodev,size=16m,mode=1777 \
  --mount "type=bind,src=$work/fixture,dst=/fixture,readonly" \
  "$(cat "$work/image-id")" bash /fixture/verify-sshd.sh
