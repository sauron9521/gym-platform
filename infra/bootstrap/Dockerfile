FROM ubuntu:24.04@sha256:562111b88caa79c71391c0c4d3c2114a7d5c35915c20561fd893cb1e07929e6b AS packages
COPY docker.sources caddy.sources /etc/apt/sources.list.d/
COPY vendor.pref /etc/apt/preferences.d/ovranto-vendor
COPY vendor-packages.lock /opt/ovranto/vendor-packages.lock
COPY install-candidate.sh /tmp/install-candidate.sh
RUN touch /tmp/ovranto-bootstrap-fixture \
    && bash /tmp/install-candidate.sh \
    && rm /tmp/install-candidate.sh /tmp/ovranto-bootstrap-fixture

# Additional parser tools for the offline service-contract rehearsal only.
FROM packages AS service-validation
RUN apt-get -o APT::Update::Error-Mode=any update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends systemd jq \
    && rm -rf /var/lib/apt/lists/* /etc/ssh/ssh_host_*

# Preserve INF09a.2's package-only default target.
FROM packages AS package-validation
