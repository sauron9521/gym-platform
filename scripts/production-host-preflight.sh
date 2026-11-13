#!/usr/bin/env bash
# Operator-only, read-only preflight. NEVER deploys or mutates production.
set -euo pipefail
umask 077

if [[ $# -ne 1 || "$1" != preflight ]]; then
  echo 'Usage: bash scripts/production-host-preflight.sh preflight' >&2
  exit 2
fi

# Do not grant CI a path to a real production host or its credentials.
if [[ -n "$(printenv GITHUB_ACTIONS || true)" ]]; then
  echo 'Run preflight only from an authorized operator host' >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# All values are operator-provided. Never print the environment or Compose JSON.
: "$DEPLOY_ENV_FILE" "$DEPLOY_RUNTIME_IMAGE" "$DEPLOY_MIGRATE_IMAGE"
: "$SOURCE_SHA" "$PUBLISH_SHA" "$EXPECTED_CURRENT_IMAGE"
: "$PRODUCTION_RELEASE_REPORT" "$BACKUP_DIR" "${RELEASE_REVIEW_RUN_ID:?Explicit successful readiness review run ID required}"

if [[ "$DEPLOY_ENV_FILE" != /* || ! -f "$DEPLOY_ENV_FILE" || -L "$DEPLOY_ENV_FILE" ]]; then
  echo 'Invalid private production env file' >&2
  exit 1
fi

for command in docker gh node sha256sum pg_restore tar; do
  command -v "$command" >/dev/null || {
    echo "Required offline/read-only command unavailable: $command" >&2
    exit 1
  }
done

# Fail fast on untrusted release receipt, missing metadata, symlinks or
# malformed checksum paths BEFORE any network or Docker operations.
node scripts/production-host-preflight.mjs evidence
# Re-fetch the exact successful review run and compare with its GitHub-hosted
# latest-attempt artifact. No local receipt alone is trusted.
node scripts/production-release-origin.mjs verify
node scripts/production-digest-guard.mjs refs

# The manifest has already been checked for *exactly* the two fixed names.
# Check archive content readability, not just the presence of files.
(cd "$BACKUP_DIR" && sha256sum --check --status SHA256SUMS)
pg_restore --list "$BACKUP_DIR/postgres.dump" >/dev/null
tar -tzf "$BACKUP_DIR/avatars.tar.gz" >/dev/null

# Verify signed SLSA and SPDX attestations of exact immutable GHCR digests.
# No image pull, registry write or Docker daemon mutation is performed.
for ref in "$DEPLOY_RUNTIME_IMAGE" "$DEPLOY_MIGRATE_IMAGE"; do
  for predicate in https://slsa.dev/provenance/v1 https://spdx.dev/Document/v2.3; do
    gh attestation verify "oci://$ref" \
      --repo sauron9521/gym-platform \
      --signer-workflow sauron9521/gym-platform/.github/workflows/publish-ghcr.yml \
      --source-ref refs/heads/main \
      --source-digest "$PUBLISH_SHA" \
      --predicate-type "$predicate" >/dev/null
  done
done

# The two images must have been cached by an operator *before* preflight.
# Docker image inspect is read-only; unlike docker pull it does not mutate cache.
node scripts/production-digest-guard.mjs images

compose=(docker compose --env-file "$DEPLOY_ENV_FILE" \
  -f infra/docker/compose.prod.yaml -f infra/docker/compose.digest.prod.yaml)
"${compose[@]}" --profile ops config --format json \
  | node scripts/production-digest-guard.mjs compose

# Read the exact image of the existing API container; fail on identity drift.
container_id="$("${compose[@]}" ps --all -q api)"
current_image=none
if [[ -n "$container_id" ]]; then
  current_image="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
fi
node scripts/production-digest-guard.mjs current "$current_image"

echo 'Preflight checks passed. PRODUCTION NO-GO: no deploy, migration or rollback ran.'
echo 'Operator must still independently verify release receipt origin,'
echo 'off-host restores, TLS, monitoring, change window and sign-off.'
