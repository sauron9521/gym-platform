# Local Redis 7 → 8 upgrade

This change applies only to local development Docker Compose
(`infra/docker/compose.yaml`). Production uses an external
`REDIS_URL`, so merging this change does **not** upgrade production Redis.

## Rehearse the migration

Run `bash scripts/test-redis-upgrade.sh` with Docker available.
The protected CI Quality check runs it only on Redis-related pull requests.

The rehearsal creates temporary Docker containers and volumes with no
published ports, verifies String/Hash/List/Sorted Set/TTL/AOF/ACL data with
Redis 7, then opens the same AOF with Redis 8. Finally it restores a **separate**
Redis 7 volume from a full pre-upgrade backup. It never mounts or changes
the application's existing Redis data volume.

## Safely migrate existing local Redis data

1. Identify the active Redis volume with `docker volume ls` (usually
   `gym-platform-local_redis_data`) and ensure writes have stopped.
2. Stop Redis cleanly:
   `docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml stop redis`.
3. Back up **the entire Redis volume**, including `appendonlydir/` and its
   multi-part AOF manifest, to an external, verified archive before upgrading.
4. After merging, start:
   `docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml up -d redis`.
5. Verify `redis-cli INFO server` reports Redis 8, review container logs,
   and manually test sessions, throttling, caching, and reconnections.

**Rollback:** Stop Redis 8, restore the backed-up Redis 7 files into a
**new** volume, and start Redis 7 against that restored volume. Never point
Redis 7 at an already-upgraded Redis 8 data volume or run
`docker compose down -v` during recovery.

The CI rehearsal is not a production migration, and does not exercise
application-specific Redis ACL policies or Redis cluster/replication behavior.

Redis 8 offers AGPLv3, RSALv2, and SSPLv1 licensing options. Review the
applicable terms before offering a hosted service or redistributing Redis.

Official references:

- https://redis.io/docs/latest/operate/oss_and_stack/install/upgrade/standalone/
- https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/
- https://redis.io/legal/licenses/
