#!/bin/sh
set -eu
[ "$(id -u)" = 70 ]
[ -f /.dockerenv ]
[ ! -e /tmp/ovranto-pgbackrest-fixture ]
[ -z "$(ls -A /repo)" ]
umask 077
root=/tmp/ovranto-pgbackrest-fixture
source="$root/source"
target="$root/target"
config="$root/pgbackrest.conf"
mkdir -p "$root/source-socket" "$root/target-socket" "$root/lock" "$root/log" "$root/spool"
cleanup() {
  for dir in "$target" "$source"; do
    if [ -f "$dir/postmaster.pid" ]; then
      pg_ctl -D "$dir" -m immediate -w -t 15 stop >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT
trap 'exit 1' INT TERM
# Random synthetic repository passphrase, never printed or supplied on CLI.
pass="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
cat > "$config" <<CONF
[global]
repo1-path=/repo
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=$pass
repo1-retention-full=2
repo1-retention-archive=2
repo1-retention-archive-type=full
lock-path=$root/lock
log-path=$root/log
spool-path=$root/spool
log-level-console=warn
log-level-file=off
process-max=2
archive-timeout=30
[fixture]
pg1-path=$source
pg1-port=55431
pg1-socket-path=$root/source-socket
CONF
unset pass
pbr() {
  pgbackrest --config="$config" --stanza=fixture "$@"
}
pgbackrest version
pg_ctl --version
pg_ctl --version | grep -Eq "PostgreSQL\) 17\."
psql --version | grep -Eq "PostgreSQL\) 17\."
initdb -D "$source" --locale=C --encoding=UTF8 --auth-local=trust --auth-host=reject --no-instructions >/dev/null
cat >> "$source/postgresql.conf" <<CONF
listen_addresses = ''
unix_socket_directories = '$root/source-socket'
port = 55431
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --config=$config --stanza=fixture archive-push "%p"'
shared_buffers = 32MB
CONF
pg_ctl -D "$source" -l "$root/source.log" -w -t 30 start
src() {
  psql -X -v ON_ERROR_STOP=1 -qAt -h "$root/source-socket" -p 55431 -d postgres "$@"
}
dst() {
  psql -X -v ON_ERROR_STOP=1 -qAt -h "$root/target-socket" -p 55432 -d postgres "$@"
}
pbr stanza-create
echo stanza-created
pbr check
echo archive-check-passed
src -c "CREATE TABLE fixture (id integer PRIMARY KEY, value text NOT NULL); INSERT INTO fixture VALUES (1,'before-backup');"
pbr --type=full backup
echo full-backup-created
pbr info > "$root/info"
cat "$root/info"
grep -q 'status: ok' "$root/info"
grep -q 'cipher: aes-256-cbc' "$root/info"
grep -q 'full backup:' "$root/info"
# Prove the repository cannot be opened with a wrong key, then confirm correct key.
if PGBACKREST_REPO1_CIPHER_PASS=synthetic-wrong-key pgbackrest --config="$config" --stanza=fixture info > "$root/wrong-key.log" 2>&1; then
  # info may exit zero for an unavailable stanza; require a cryptographic failure.
  if grep -q 'status: ok' "$root/wrong-key.log"; then
    echo 'Unexpected acceptance of wrong repository key' >&2
    exit 1
  fi
fi
grep -q "status: error" "$root/wrong-key.log"
grep -Fq "unable to load info file" "$root/wrong-key.log"
grep -Fq "/repo/backup/fixture/backup.info" "$root/wrong-key.log"
echo wrong-key-rejected
pbr info | grep -q 'status: ok'
src -c "INSERT INTO fixture VALUES (2,'recover-me');"
src -c "SELECT pg_create_restore_point('ovranto_encrypted_target');" >/dev/null
src -c "UPDATE fixture SET value='later-change' WHERE id=1; INSERT INTO fixture VALUES (3,'after-target');"
wal="$(src -c 'SELECT pg_walfile_name(pg_current_wal_insert_lsn());')"
src -c 'SELECT pg_switch_wal();' >/dev/null
i=0
while [ "$i" -lt 30 ] && [ "$(src -c "SELECT coalesce(last_archived_wal >= '$wal', false) FROM pg_stat_archiver;")" != t ]; do
  i=$((i+1))
  sleep 1
done
[ "$i" -lt 30 ] || { echo 'Encrypted WAL archive did not complete' >&2; exit 1; }
mkdir "$root/retrieved"
pbr archive-get "$wal" "$root/retrieved/$wal"
echo wal-retrieved
[ -s "$root/retrieved/$wal" ]
[ "$(wc -c < "$root/retrieved/$wal" | tr -d ' ')" = 16777216 ]
[ "$(src -c "SELECT string_agg(id||':'||value,',' ORDER BY id) FROM fixture;")" = '1:later-change,2:recover-me,3:after-target' ]
pg_ctl -D "$source" -m fast -w -t 30 stop
[ ! -e "$target" ]
mkdir "$target"
pbr --pg1-path="$target" --type=name --target=ovranto_encrypted_target --target-action=promote restore
cat >> "$target/postgresql.conf" <<CONF
unix_socket_directories = '$root/target-socket'
port = 55432
archive_mode = off
CONF
pg_ctl -D "$target" -l "$root/target.log" -w -t 30 start || { cat "$root/target.log"; exit 1; }
i=0
while [ "$i" -lt 30 ] && [ "$(dst -c 'SELECT pg_is_in_recovery();' 2>/dev/null || true)" != f ]; do
  i=$((i+1))
  sleep 1
done
[ "$i" -lt 30 ] || { cat "$root/target.log"; exit 1; }
grep -Fq "restored log file \"$wal\" from archive" "$root/target.log"
grep -q 'recovery stopping at restore point "ovranto_encrypted_target"' "$root/target.log"
[ "$(dst -c "SELECT string_agg(id||':'||value,',' ORDER BY id) FROM fixture;")" = '1:before-backup,2:recover-me' ]
dst -c "INSERT INTO fixture VALUES (4,'restored-write');"
[ "$(dst -c 'SELECT count(*) FROM fixture;')" = 3 ]
pg_ctl -D "$target" -m fast -w -t 30 stop
pg_ctl -D "$source" -l "$root/source.log" -w -t 30 start
[ "$(src -c "SELECT string_agg(id||':'||value,',' ORDER BY id) FROM fixture;")" = '1:later-change,2:recover-me,3:after-target' ]
pg_ctl -D "$source" -m fast -w -t 30 stop
echo 'pgBackRest PASS: AES-256-CBC encrypted repository, wrong-key rejection, full backup, archived WAL, named-point restore, restored write and unchanged source.'
