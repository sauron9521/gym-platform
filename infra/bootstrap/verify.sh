#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
cp "$root"/{Dockerfile,docker.sources,caddy.sources,install-candidate.sh,vendor-packages.lock,vendor.pref} "$work/"
docker build --platform linux/amd64 --iidfile "$work/image-id" "$work"
docker run --rm --platform linux/amd64 --network none --read-only \
  --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --cpus 1 --pids-limit 64 \
  --tmpfs /tmp:rw,nosuid,nodev,size=16m,mode=1777 \
  --env HOME=/tmp --entrypoint bash "$(cat "$work/image-id")" -ec '
  . /etc/os-release
  test "$ID" = ubuntu && test "$VERSION_ID" = 24.04
  test "$(dpkg --print-architecture)" = amd64
  dpkg-query -W -f="\${Package} \${Version} \${db:Status-Status}\\n" ca-certificates openssh-server docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin caddy
  while IFS="=" read -r package version; do
    test "$(dpkg-query -W -f="\${Version}" "$package")" = "$version"
  done < /opt/ovranto/vendor-packages.lock
  docker --version
  docker compose version
  docker buildx version
  containerd --version
  caddy version
  /usr/sbin/sshd -V
  test ! -S /var/run/docker.sock
  test ! -S /run/containerd/containerd.sock
  test -z "$(find /etc/ssh -maxdepth 1 -name "ssh_host_*" -print)"
  test -x /usr/sbin/policy-rc.d
  rc=0; /usr/sbin/policy-rc.d || rc=$?
  test "$rc" = 101
  echo "Ubuntu package candidate PASS: no daemon startup, no Docker socket, no retained SSH host keys."
'
