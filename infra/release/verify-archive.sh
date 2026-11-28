#!/usr/bin/env bash
# Disposable six-image archive contract rehearsal; never publishes or attests.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
tags=()
cleanup() {
  for tag in "${tags[@]}"; do docker image rm "$tag" >/dev/null 2>&1 || true; done
  rm -rf -- "$work"
}
trap cleanup EXIT
trap 'exit 1' INT TERM
repo=fixture/inf08-archive
sha="$(od -An -N20 -tx1 /dev/urandom | tr -d ' \n')"
run=1
base='node:24-trixie-slim@sha256:4d00acb4bcc42c454c4eb801526f7ad7f772ea3bd4fd168c5cc2e384abcbb9d4'
bash "$root/infra/release/verify-node-base.sh" "$base"
alpine="node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5"
docker run --rm --network none --read-only --user node --cap-drop ALL --security-opt no-new-privileges --entrypoint sh "$alpine" -ec '. /etc/os-release; test "$ID" = alpine'
if bash "$root/infra/release/verify-node-base.sh" "$alpine"; then
  echo "Alpine base unexpectedly accepted" >&2; exit 1
fi
mkdir -m 700 "$work/release" "$work/context"
printf 'FROM %s\nUSER node\n' "$base" > "$work/context/Dockerfile"
for component in runtime migrate landing web trainer admin; do
  tag="gym-full-stack-$component:$sha"
  if docker image inspect "$tag" >/dev/null 2>&1; then
    echo 'Unexpected existing fixture tag' >&2; exit 1
  fi
  tags+=("$tag")
  docker build --platform linux/amd64 --network none \
    --label "org.opencontainers.image.revision=$sha" \
    --label "org.opencontainers.image.source=https://github.com/$repo" \
    --label "org.ovranto.release.component=$component" \
    --label org.ovranto.release.profile=full-stack-pilot-noindex \
    -t "$tag" "$work/context"
done
release() {
  node "$root/scripts/full-stack-release.mjs" "$1" "$repo" "$sha" "$run" "$work/release"
}
docker save "${tags[@]}" | gzip -n -6 > "$work/release/images.tar.gz"
release create
release verify
release verify-images
# Change one byte without changing length, then restore the original archive.
node --input-type=module - "$work/release/images.tar.gz" <<'JS'
import { openSync, readSync, writeSync, closeSync } from 'node:fs';
const fd = openSync(process.argv[2], 'r+');
const byte = Buffer.alloc(1);
readSync(fd, byte, 0, 1, 0);
byte[0] ^= 1;
writeSync(fd, byte, 0, 1, 0);
closeSync(fd);
JS
if release verify; then echo 'Tampered archive accepted' >&2; exit 1; fi
node --input-type=module - "$work/release/images.tar.gz" <<'JS'
import { openSync, readSync, writeSync, closeSync } from 'node:fs';
const fd = openSync(process.argv[2], 'r+');
const byte = Buffer.alloc(1);
readSync(fd, byte, 0, 1, 0);
byte[0] ^= 1;
writeSync(fd, byte, 0, 1, 0);
closeSync(fd);
JS
release verify
docker image rm "${tags[@]}"
for tag in "${tags[@]}"; do
  if docker image inspect "$tag" >/dev/null 2>&1; then exit 1; fi
done
docker load -i "$work/release/images.tar.gz"
release verify-images
# Swap one fixture tag for another component's image to exercise real inspect.
docker tag "${tags[4]}" "${tags[5]}"
if release verify-images; then echo 'Substituted image accepted' >&2; exit 1; fi
docker load -i "$work/release/images.tar.gz"
release verify-images
echo 'Archive contract PASS: six synthetic image identities, byte-tamper rejection, save/load, substitution rejection. No signatures or application builds.'
