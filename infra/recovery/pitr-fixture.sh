#!/bin/sh
set -eu
# The wrapper starts a new isolated container as postgres. Never use live PGDATA.
[ "$(id -u)" = 70 ]
[ -f /.dockerenv ]
[ ! -e /tmp/ovranto-pitr-fixture ]
umask 077
root=/tmp/ovranto-pitr-fixture
source="$root/source"
target="$root/target"
archive="$root/archive"
mkdir -p "$root/source-socket" "$root/target-socket" "$archive"
cleanup() {
  for dir in "$target" "$source"; do
    if [ -f "$dir/postmaster.pid" ]; then
      pg_ctl -D "$dir" -m immediate -w -t 15 stop >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT
trap 'exit 1' INT TERM
initdb -D "$source" --locale=C --encoding=UTF8 --auth-local=trust --auth-host=reject --no-instructions >/dev/null
cat >> "$source/postgresql.conf" <<CONF
listen_addresses = ''
unix_socket_directories = '$root/source-socket'
port = 55431
wal_level = replica
archive_mode = on
archive_command = 'test ! -f "$archive/%f" && cp "%p" "$archive/%f"'
max_wal_senders = 4
shared_buffers = 32MB
CONF
pg_ctl -D "$source" -l "$root/source.log" -w -t 30 start
src() {
  psql -X -v ON_ERROR_STOP=1 -qAt -h "$root/source-socket" -p 55431 -d postgres "$@"
}
dst() {
  psql -X -v ON_ERROR_STOP=1 -qAt -h "$root/target-socket" -p 55432 -d postgres "$@"
}
src -c "CREATE TABLE fixture (id integer PRIMARY KEY, value text NOT NULL); INSERT INTO fixture VALUES (1,'before-backup');"
pg_basebackup -h "$root/source-socket" -p 55431 -D "$target" -X stream --checkpoint=fast --manifest-checksums=SHA256
pg_verifybackup "$target"
# Verify that checksum validation actually refuses a damaged synthetic backup.
cp "$target/PG_VERSION" "$root/original-version"
printf '18\n' > "$target/PG_VERSION"
if pg_verifybackup "$target" > "$root/damaged.log" 2>&1; then
  echo 'Unexpected acceptance of damaged base backup' >&2
  exit 1
fi
grep -q 'checksum mismatch.*PG_VERSION\|PG_VERSION.*checksum mismatch' "$root/damaged.log"
cp "$root/original-version" "$target/PG_VERSION"
pg_verifybackup "$target"
src -c "INSERT INTO fixture VALUES (2,'recover-me');"
src -c "SELECT pg_create_restore_point('ovranto_fixture_target');" >/dev/null
src -c "UPDATE fixture SET value='later-change' WHERE id=1; INSERT INTO fixture VALUES (3,'after-target');"
wal="$(src -c 'SELECT pg_walfile_name(pg_current_wal_insert_lsn());')"
src -c 'SELECT pg_switch_wal();' >/dev/null
# Wait for the real archiver, not just for the archive file to appear.
i=0
while [ "$i" -lt 30 ]; do
  if [ -s "$archive/$wal" ] && [ "$(src -c "SELECT coalesce(last_archived_wal >= '$wal', false) FROM pg_stat_archiver;")" = t ]; then
    break
  fi
  i=$((i+1))
  sleep 1
done
[ "$i" -lt 30 ] || { echo 'WAL archive did not complete' >&2; exit 1; }
# Ensure this segment is not already present in the base backup.
[ ! -e "$target/pg_wal/$wal" ]
[ "$(src -c "SELECT string_agg(id||':'||value,',' ORDER BY id) FROM fixture;")" = '1:later-change,2:recover-me,3:after-target' ]
pg_ctl -D "$source" -m fast -w -t 30 stop
cat >> "$target/postgresql.conf" <<CONF
unix_socket_directories = '$root/target-socket'
port = 55432
archive_mode = off
restore_command = 'cp "$archive/%f" "%p"'
recovery_target_name = 'ovranto_fixture_target'
recovery_target_action = 'promote'
CONF
touch "$target/recovery.signal"
pg_ctl -D "$target" -l "$root/target.log" -w -t 30 start || { cat "$root/target.log"; exit 1; }
i=0
while [ "$i" -lt 30 ] && [ "$(dst -c 'SELECT pg_is_in_recovery();' 2>/dev/null || true)" != f ]; do
  i=$((i+1))
  sleep 1
done
[ "$i" -lt 30 ] || { cat "$root/target.log"; exit 1; }
# Verify that WAL actually came from the archive and stopped at the named point.
grep -Fq "restored log file \"$wal\" from archive" "$root/target.log"
grep -q 'recovery stopping at restore point "ovranto_fixture_target"' "$root/target.log"
[ "$(dst -c "SELECT string_agg(id||':'||value,',' ORDER BY id) FROM fixture;")" = '1:before-backup,2:recover-me' ]
dst -c "INSERT INTO fixture VALUES (4,'restored-write');"
[ "$(dst -c 'SELECT count(*) FROM fixture;')" = 3 ]
pg_ctl -D "$target" -m fast -w -t 30 stop
# The original cluster must retain its post-target state; recovery did not rewrite it.
pg_ctl -D "$source" -l "$root/source.log" -w -t 30 start
[ "$(src -c "SELECT string_agg(id||':'||value,',' ORDER BY id) FROM fixture;")" = '1:later-change,2:recover-me,3:after-target' ]
pg_ctl -D "$source" -m fast -w -t 30 stop
echo 'PostgreSQL PITR PASS: verified base backup, rejected corruption, archived WAL, named restore point, excluded later changes, restored write and original source unchanged.'
