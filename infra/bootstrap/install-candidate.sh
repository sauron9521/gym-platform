#!/usr/bin/env bash
# Intended exclusively for a disposable Docker build, never for host execution.
set -euo pipefail
test "$0" = /tmp/install-candidate.sh
test -f /tmp/ovranto-bootstrap-fixture
export LC_ALL=C
. /etc/os-release
test "$ID" = ubuntu
test "$VERSION_ID" = 24.04
test "$(dpkg --print-architecture)" = amd64
export DEBIAN_FRONTEND=noninteractive
printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d
chmod 0755 /usr/sbin/policy-rc.d
# Bootstrap Ubuntu trust first, then enable dedicated third-party keyrings.
mkdir -p /tmp/ovranto-sources
mv /etc/apt/sources.list.d/{docker,caddy}.sources /tmp/ovranto-sources/
apt-get -o APT::Update::Error-Mode=any update
apt-get install -y --no-install-recommends ca-certificates curl gpg
install -d -m 0755 /etc/apt/keyrings
export GNUPGHOME
GNUPGHOME="$(mktemp -d)"
install_key() {
  local url="$1" expected="$2" dest="$3" actual
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-time 60 "$url" -o "$GNUPGHOME/key.asc"
  actual="$(gpg --batch --with-colons --show-keys "$GNUPGHOME/key.asc" | awk -F: '$1=="pub"{primary=1;next} primary && $1=="fpr"{print $10;primary=0}')"
  test "$actual" = "$expected"
  install -m 0644 "$GNUPGHOME/key.asc" "$dest"
}
install_key https://download.docker.com/linux/ubuntu/gpg 9DC858229FC7DD38854AE2D88D81803C0EBFCD88 /etc/apt/keyrings/docker.asc
install_key https://dl.cloudsmith.io/public/caddy/stable/gpg.key 65760C51EDEA2017CEA2CA15155B6D79CA56EA34 /etc/apt/keyrings/caddy.asc
mv /tmp/ovranto-sources/*.sources /etc/apt/sources.list.d/
apt-get -o APT::Update::Error-Mode=any update
apt-cache policy docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin caddy openssh-server
mapfile -t packages < /opt/ovranto/vendor-packages.lock
apt-get install -y --no-install-recommends openssh-server "${packages[@]}"
dpkg-query -W ca-certificates openssh-server docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin caddy
# Repeat must require no package operations.
apt-get -s install --no-install-recommends openssh-server "${packages[@]}" | tee /tmp/repeat-install
grep -F '0 upgraded, 0 newly installed, 0 to remove' /tmp/repeat-install
rm -rf "$GNUPGHOME" /tmp/ovranto-sources /tmp/repeat-install /var/lib/apt/lists/*
rm -f /etc/ssh/ssh_host_*
