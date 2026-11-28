#!/usr/bin/env bash
# Reproducible credential-free validation. Never runs real plan or apply.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
image='ghcr.io/opentofu/opentofu@sha256:1887e50f044f478a9fc6b543c4df482a4009925ad129a9e646ab9274be6731f1'
# Copy configuration and reviewed locks only, never local state, credentials or tfvars.
for dir in modules/vps staging production; do
  mkdir -p "$work/$dir/tests"
  cp "$root/$dir/"*.tf "$root/$dir/.terraform.lock.hcl" "$work/$dir/"
  cp "$root/$dir/tests/"*.tftest.hcl "$work/$dir/tests/"
done
run() {
  local network="$1" dir="$2"
  shift 2
  docker run --rm --network "$network" --user "$(id -u):$(id -g)" \
    --cap-drop ALL --security-opt no-new-privileges \
    -v "$work:/work" -w "/work/$dir" "$image" "$@"
}
run none . fmt -check -recursive
for dir in modules/vps staging production; do
  # Registry downloads only, locked provider, no backend initialization.
  run bridge "$dir" init -backend=false -input=false -lockfile=readonly -no-color
  # No network access even if a mock configuration is accidentally broken.
  run none "$dir" validate -no-color
  run none "$dir" test -no-color
done
