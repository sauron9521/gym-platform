FROM python:3.12-slim-bookworm@sha256:44cf1793efa7c7a476bb0f2cff81443f4a072c90c1cb127e2924933daa3e8c64
COPY requirements.lock /tmp/requirements.lock
RUN pip --disable-pip-version-check install --no-cache-dir --only-binary=:all: --require-hashes -r /tmp/requirements.lock \
    && pip check
ENV HOME=/tmp
USER 65534:65534
WORKDIR /fixture
