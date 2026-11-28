# syntax=docker/dockerfile:1
# DEP02: isolated, non-indexable container pilot; not a release image yet.
ARG NODE_BASE_IMAGE=node:24-trixie-slim@sha256:4d00acb4bcc42c454c4eb801526f7ad7f772ea3bd4fd168c5cc2e384abcbb9d4
FROM ${NODE_BASE_IMAGE} AS build
WORKDIR /workspace
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.18.0 --no-audit --no-fund
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json tooling/*/package.json ./
RUN pnpm --filter @gym/landing... install --frozen-lockfile
COPY . .
ENV GYM_LANDING_STANDALONE=true LANDING_ENABLE_I18N_ROUTES=true LANDING_ALLOW_INDEXING=false
RUN pnpm --filter @gym/landing build \
    && test -f apps/landing/.next/standalone/apps/landing/server.js

FROM ${NODE_BASE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    LANDING_ENABLE_I18N_ROUTES=true LANDING_ALLOW_INDEXING=false
COPY --from=build --chown=node:node /workspace/apps/landing/.next/standalone/ ./
COPY --from=build --chown=node:node /workspace/apps/landing/.next/static/ ./apps/landing/.next/static/
COPY --from=build --chown=node:node /workspace/apps/landing/public/ ./apps/landing/public/
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/uk',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))"
CMD ["node", "apps/landing/server.js"]
