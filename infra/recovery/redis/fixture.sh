#!/bin/sh
set -eu
[ "$(id -u)" = 999 ]
[ -f /.dockerenv ]
root=/tmp/ovranto-redis-fixture
[ ! -e "$root" ]
umask 077
mkdir -p "$root/data"
pid=
cleanup() {
  if [ -n "$pid" ]; then
    kill -TERM "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 1' INT TERM
cli() {
  redis-cli --raw -s "$root/redis.sock" "$@"
}
start() {
  redis-server /fixture.conf > "$root/server.log" 2>&1 &
  pid=$!
  i=0
  while [ "$i" -lt 50 ]; do
    if [ "$(cli PING 2>/dev/null || true)" = PONG ]; then
      return
    fi
    kill -0 "$pid" 2>/dev/null || { cat "$root/server.log"; exit 1; }
    i=$((i+1))
    sleep 0.2
  done
  cat "$root/server.log"
  exit 1
}
redis-server --version
start
[ "$(cli CONFIG GET appendfsync | tail -1)" = everysec ]
[ "$(cli CONFIG GET maxmemory-policy | tail -1)" = noeviction ]
[ "$(cli CONFIG GET aof-load-truncated | tail -1)" = no ]
# Synthetic counters with TTL, not actual account identifiers or app state.
counter=gym:throttle:fixture-counter
block=gym:throttle:block:fixture-block
[ "$(cli SET "$counter" 1 EX 300)" = OK ]
[ "$(cli SAVE)" = OK ]
# RDB now contains count=1; the newer AOF must win on restart.
[ "$(cli INCR "$counter")" = 2 ]
[ "$(cli SET "$block" 1 EX 300)" = OK ]
[ "$(cli SET fixture:expires value EX 1)" = OK ]
# Wait on the same client connection that performs a write.
ack="$(printf 'SET fixture:durable yes\nWAITAOF 1 0 5000\n' | redis-cli --raw -s "$root/redis.sock")"
[ "$ack" = "$(printf 'OK\n1\n0')" ]
before="$(cli PTTL "$counter")"
[ "$before" -gt 0 ]
# Crash only the child process started by this fixture, not any host Redis.
kill -KILL "$pid"
wait "$pid" 2>/dev/null || true
pid=
redis-check-rdb "$root/data/dump.rdb"
redis-check-aof "$root/data/appendonlydir/appendonly.aof.manifest"
sleep 2
start
[ "$(cli GET "$counter")" = 2 ]
[ "$(cli GET "$block")" = 1 ]
[ "$(cli GET fixture:durable)" = yes ]
[ "$(cli EXISTS fixture:expires)" = 0 ]
after="$(cli PTTL "$counter")"
[ "$after" -gt 0 ] && [ "$after" -lt "$before" ]
[ "$(cli PTTL "$block")" -gt 0 ]
# Force a synthetic memory ceiling without allocating a large payload.
[ "$(cli CONFIG SET maxmemory 1)" = OK ]
case "$(cli SET fixture:pressure value 2>&1)" in
  *OOM*) ;;
  *) echo 'Expected noeviction write refusal' >&2; exit 1 ;;
esac
[ "$(cli GET "$counter")" = 2 ]
[ "$(cli GET "$block")" = 1 ]
[ "$(cli EXISTS fixture:pressure)" = 0 ]
[ "$(cli CONFIG SET maxmemory 33554432)" = OK ]
[ "$(cli INCR "$counter")" = 3 ]
[ "$(cli SHUTDOWN NOSAVE)" = '' ]
wait "$pid"
pid=
echo 'Redis recovery PASS: RDB and multipart AOF verified, fsync-acknowledged writes recovered after crash, TTL preserved and expired key absent, noeviction refuses writes without dropping security counters.'
