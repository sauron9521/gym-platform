FROM postgres:17-alpine@sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32
# Resolve distro patch dependencies from the signed Alpine repository.
RUN apk add --no-cache pgbackrest=2.58.0-r0
USER postgres
