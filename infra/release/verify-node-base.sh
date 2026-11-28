#!/usr/bin/env bash
# Check actual OS and ABI, not the human-readable name before @sha256.
set -euo pipefail
[[ $# -eq 1 ]]
image="$1"
docker run --rm --platform linux/amd64 --network none --read-only \
  --user node --cap-drop ALL --security-opt no-new-privileges \
  --memory 128m --cpus 1 --pids-limit 32 --entrypoint sh "$image" -ec '
  . /etc/os-release
  test "$ID" = debian
  test "$VERSION_ID" = 13
  test "$VERSION_CODENAME" = trixie
  test "$(getconf GNU_LIBC_VERSION | cut -d " " -f 1)" = glibc
  node -e "if(process.versions.node.split(\".\")[0]!==\"24\")process.exit(1)"
  printf "Verified Debian 13 / glibc / Node 24: %s\n" "$(node --version)"
'
