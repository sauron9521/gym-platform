#!/bin/sh
set -eu
[ "$(id -u)" = 70 ]
[ -f /.dockerenv ]
root=/tmp/ovranto-restic-fixture
[ ! -e "$root" ]
[ -z "$(ls -A /repo)" ]
umask 077
mkdir -p "$root/source-media" "$root/socket" "$root/bundle" "$root/cache"
export RESTIC_REPOSITORY=/repo
export RESTIC_PASSWORD_FILE="$root/password"
export RESTIC_CACHE_DIR="$root/cache"
od -An -N32 -tx1 /dev/urandom | tr -d ' \n' > "$RESTIC_PASSWORD_FILE"
printf '\n' >> "$RESTIC_PASSWORD_FILE"
cleanup() {
  if [ -f "$root/db/postmaster.pid" ]; then
    pg_ctl -D "$root/db" -m immediate -w -t 15 stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 1' INT TERM
restic version
pg_ctl --version
initdb -D "$root/db" --locale=C --encoding=UTF8 --auth-local=trust --auth-host=reject --no-instructions >/dev/null
cat >> "$root/db/postgresql.conf" <<CONF
listen_addresses = ''
unix_socket_directories = '$root/socket'
port = 55431
shared_buffers = 32MB
CONF
pg_ctl -D "$root/db" -l "$root/postgres.log" -w -t 30 start
sql() {
  database="$1"
  shift
  psql -X -qAt -v ON_ERROR_STOP=1 -h "$root/socket" -p 55431 -d "$database" "$@"
}
createdb -h "$root/socket" -p 55431 fixture_source
createdb -h "$root/socket" -p 55431 fixture_restore
# Synthetic stand-ins for profile avatar references, not the application schema.
keep=11111111-1111-4111-8111-111111111111.png
deleted=22222222-2222-4222-8222-222222222222.png
orphan=33333333-3333-4333-8333-333333333333.png
printf 'synthetic retained media\n' > "$root/source-media/$keep"
printf 'synthetic deleted media\n' > "$root/source-media/$deleted"
printf 'synthetic orphan media\n' > "$root/source-media/$orphan"
keep_sha="$(sha256sum "$root/source-media/$keep" | cut -d ' ' -f1)"
deleted_sha="$(sha256sum "$root/source-media/$deleted" | cut -d ' ' -f1)"
sql fixture_source -c "CREATE TABLE profiles (id integer PRIMARY KEY, avatar_key text UNIQUE, sha256 text); INSERT INTO profiles VALUES (1,'$keep','$keep_sha'),(2,'$deleted','$deleted_sha');"
# No concurrent writers. Pair the logical dump and media under one snapshot.
pg_dump -h "$root/socket" -p 55431 -Fc --no-owner --no-acl -f "$root/bundle/postgres.dump" fixture_source
cp -R "$root/source-media" "$root/bundle/media"
printf 'fixture-recovery-point-v1\n' > "$root/bundle/point"
restic init
restic backup --tag fixture-recovery-point-v1 "$root/bundle"
restic check --read-data
# The repository must not open using a wrong password.
printf 'fixture-wrong-password\n' > "$root/wrong-password"
if RESTIC_PASSWORD_FILE="$root/wrong-password" restic snapshots > "$root/wrong-key.log" 2>&1; then
  echo 'Wrong password unexpectedly accepted' >&2
  exit 1
fi
grep -qi 'wrong password' "$root/wrong-key.log"
# Model current privacy evidence retained independently of the old snapshot.
# No live deletion ledger or real user data is involved.
printf '%s\n' "$deleted" > "$root/current-tombstones"
sql fixture_source -c 'UPDATE profiles SET avatar_key=NULL, sha256=NULL WHERE id=2;'
rm "$root/source-media/$deleted"
printf 'later source change\n' > "$root/source-media/$keep"
# Restore only into a fresh private directory and empty synthetic database.
[ ! -e "$root/restored" ]
restic restore latest --tag fixture-recovery-point-v1 --target "$root/restored" --verify
restored="$root/restored$root/bundle"
[ "$(cat "$restored/point")" = fixture-recovery-point-v1 ]
[ "$(sql fixture_restore -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';")" = 0 ]
pg_restore -h "$root/socket" -p 55431 --exit-on-error --single-transaction --no-owner --no-acl -d fixture_restore "$restored/postgres.dump"
[ "$(sql fixture_restore -c 'SELECT count(*) FROM profiles WHERE avatar_key IS NOT NULL;')" = 2 ]
# No restored file is served. Validate names and hashes before reconciliation.
verify_refs() {
  sql fixture_restore -c "SELECT avatar_key||'|'||sha256 FROM profiles WHERE avatar_key IS NOT NULL ORDER BY id;" > "$root/refs"
  while IFS='|' read -r key sha; do
    printf '%s\n' "$key" | grep -Eq '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$' || return 1
    [ -f "$restored/media/$key" ] && [ ! -L "$restored/media/$key" ] || return 1
    [ "$(sha256sum "$restored/media/$key" | cut -d ' ' -f1)" = "$sha" ] || return 1
  done < "$root/refs"
}
verify_refs
# Prove that a missing or changed referenced file prevents acceptance.
mv "$restored/media/$keep" "$root/retained"
if verify_refs; then echo 'Missing file accepted' >&2; exit 1; fi
printf 'wrong content\n' > "$restored/media/$keep"
if verify_refs; then echo 'Changed file accepted' >&2; exit 1; fi
mv "$root/retained" "$restored/media/$keep"
verify_refs
# Reapply newer deletion evidence before constructing the publishable set.
# This is an intentionally narrow synthetic policy, not a general production tool.
[ "$(cat "$root/current-tombstones")" = "$deleted" ]
sql fixture_restore -c "UPDATE profiles SET avatar_key=NULL, sha256=NULL WHERE avatar_key='$deleted';"
mkdir "$root/eligible"
verify_refs
while IFS='|' read -r key sha; do
  [ "$key" != "$deleted" ]
  cp "$restored/media/$key" "$root/eligible/$key"
done < "$root/refs"
[ "$(ls -A "$root/eligible")" = "$keep" ]
[ "$(sha256sum "$root/eligible/$keep" | cut -d ' ' -f1)" = "$keep_sha" ]
[ "$(sql fixture_restore -c 'SELECT count(*) FROM profiles WHERE id=2 AND avatar_key IS NULL;')" = 1 ]
[ ! -e "$root/eligible/$deleted" ]
[ ! -e "$root/eligible/$orphan" ]
[ "$(sql fixture_source -c 'SELECT count(*) FROM profiles WHERE id=2 AND avatar_key IS NULL;')" = 1 ]
[ "$(cat "$root/source-media/$keep")" = 'later source change' ]
[ ! -e "$root/source-media/$deleted" ]
pg_ctl -D "$root/db" -m fast -w -t 30 stop
echo 'Restic recovery PASS: encrypted paired snapshot, wrong-key rejection, full repository data check, verified restore, missing/changed media rejection, current tombstone and orphan exclusion, unchanged source.'
