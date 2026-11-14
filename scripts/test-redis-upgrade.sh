#!/usr/bin/env bash
# Disposable Redis 7 -> Redis 8 AOF upgrade and backup-restore rehearsal.
# Never mounts the application's real Docker Compose volumes.
set -euo pipefail

command -v docker >/dev/null || { echo 'Docker is required' >&2; exit 1; }

scratch="$(mktemp -d)"
suffix="$(basename "$scratch" | tr -cd '[:alnum:]')"
volume="gym-redis-upgrade-$suffix"
restore_volume="gym-redis-restore-$suffix"
old="gym-redis7-$suffix"
new="gym-redis8-$suffix"
restored="gym-redis7-restore-$suffix"

# Reject collisions rather than ever overwriting existing Docker resources.
for container in "$old" "$new" "$restored"; do
  if docker container inspect "$container" >/dev/null 2>&1; then
    echo "Existing container $container, refusing to proceed" >&2
    rm -rf -- "$scratch"
    exit 1
  fi
done
for name in "$volume" "$restore_volume"; do
  if docker volume inspect "$name" >/dev/null 2>&1; then
    echo "Existing volume $name, refusing to proceed" >&2
    rm -rf -- "$scratch"
    exit 1
  fi
done

cleanup() {
  docker rm -f "$old" "$new" "$restored" >/dev/null 2>&1 || true
  docker volume rm "$volume" "$restore_volume" >/dev/null 2>&1 || true
  rm -rf -- "$scratch"
}
trap cleanup EXIT

ready() {
  local container="$1"
  local attempt
  for attempt in $(seq 1 60); do
    if [ "$(docker exec "$container" redis-cli --raw PING 2>/dev/null || true)" = PONG ]; then
      return 0
    fi
    sleep 1
  done
  echo "Redis in $container did not become ready" >&2
  docker logs "$container" >&2 || true
  return 1
}

verify_data() {
  local container="$1"
  test "$(docker exec "$container" redis-cli --raw GET gym:upgrade:string)" = redis7-value
  test "$(docker exec "$container" redis-cli --raw HGET gym:upgrade:hash field)" = hash-value
  test "$(docker exec "$container" redis-cli --raw LRANGE gym:upgrade:list 0 -1)" = "$(printf 'one\ntwo')"
  test "$(docker exec "$container" redis-cli --raw ZSCORE gym:upgrade:zset member)" = 42
  test "$(docker exec "$container" redis-cli --raw GET gym:upgrade:ttl)" = expiring
  local ttl
  ttl="$(docker exec "$container" redis-cli --raw TTL gym:upgrade:ttl)"
  test "$ttl" -gt 0
  docker exec "$container" redis-cli --raw INFO persistence |
    tr -d '\r' | grep -qx 'aof_enabled:1'
  docker exec "$container" redis-cli --raw ACL LIST | grep -q 'user default'
}

echo 'Starting Redis 7 on a new disposable volume'
docker volume create "$volume" >/dev/null
docker run -d --rm --name "$old" --network none \
  --mount "type=volume,src=$volume,dst=/data" \
  redis:7-alpine redis-server --appendonly yes >/dev/null
ready "$old"

docker exec "$old" redis-cli SET gym:upgrade:string redis7-value >/dev/null
docker exec "$old" redis-cli HSET gym:upgrade:hash field hash-value >/dev/null
docker exec "$old" redis-cli RPUSH gym:upgrade:list one two >/dev/null
docker exec "$old" redis-cli ZADD gym:upgrade:zset 42 member >/dev/null
docker exec "$old" redis-cli SET gym:upgrade:ttl expiring EX 3600 >/dev/null
verify_data "$old"

docker exec "$old" redis-cli BGREWRITEAOF >/dev/null
rewrite_ok=false
for attempt in $(seq 1 60); do
  persistence="$(docker exec "$old" redis-cli --raw INFO persistence | tr -d '\r')"
  if grep -qx 'aof_rewrite_in_progress:0' <<< "$persistence" &&
     grep -qx 'aof_last_bgrewrite_status:ok' <<< "$persistence"; then
    rewrite_ok=true
    break
  fi
  sleep 1
done
test "$rewrite_ok" = true
docker stop --time 20 "$old" >/dev/null

# Back up ALL pre-upgrade AOF files, including the Redis 7 multi-part manifest.
docker run --rm --network none \
  --mount "type=volume,src=$volume,dst=/data,readonly" \
  --mount "type=bind,src=$scratch,dst=/backup" \
  alpine:3.21 sh -ec \
    'test -s /data/appendonlydir/appendonly.aof.manifest; tar -C /data -cf /backup/redis7-data.tar .'
test -s "$scratch/redis7-data.tar"

echo 'Starting Redis 8 on the same disposable Redis 7 AOF volume'
docker run -d --rm --name "$new" --network none \
  --mount "type=volume,src=$volume,dst=/data" \
  redis:8-alpine redis-server --appendonly yes >/dev/null
ready "$new"
docker exec "$new" redis-cli --raw INFO server | tr -d '\r' | grep -Eq '^redis_version:8\.'
verify_data "$new"
docker stop --time 20 "$new" >/dev/null

echo 'Restoring the PRE-upgrade backup onto a different volume (Redis 7)'
docker volume create "$restore_volume" >/dev/null
docker run --rm --network none \
  --mount "type=volume,src=$restore_volume,dst=/data" \
  --mount "type=bind,src=$scratch,dst=/backup,readonly" \
  alpine:3.21 sh -ec 'tar -C /data -xf /backup/redis7-data.tar'
docker run -d --rm --name "$restored" --network none \
  --mount "type=volume,src=$restore_volume,dst=/data" \
  redis:7-alpine redis-server --appendonly yes >/dev/null
ready "$restored"
verify_data "$restored"
echo 'Isolated Redis 7 -> 8 AOF and Redis 7 backup recovery: PASS'
