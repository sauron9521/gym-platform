# syntax=docker/dockerfile:1
# DEP05: fixed private upstream, isolated pilot; no release promotion.
ARG NODE_BASE_IMAGE=node:24-trixie-slim@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
FROM ${NODE_BASE_IMAGE} AS build
WORKDIR /workspace
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.18.0 --no-audit --no-fund
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json tooling/*/package.json ./
RUN pnpm --filter @gym/admin... install --frozen-lockfile
COPY . .
ENV GYM_ADMIN_STANDALONE=true GYM_API_INTERNAL_URL=http://api:3000
RUN pnpm --filter @gym/admin build \
    && test -f apps/admin/.next/standalone/apps/admin/server.js \
    && mkdir -p apps/admin/public

FROM ${NODE_BASE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    GYM_API_INTERNAL_URL=http://api:3000
COPY --from=build --chown=node:node /workspace/apps/admin/.next/standalone/ ./
COPY --from=build --chown=node:node /workspace/apps/admin/.next/static/ ./apps/admin/.next/static/
COPY --from=build --chown=node:node /workspace/apps/admin/public/ ./apps/admin/public/
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/sign-in',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))"
# Rewrites are compiled at build time; SSR must use exactly the same origin.
CMD ["node", "-e", "if(process.env.GYM_API_INTERNAL_URL!=='http://api:3000'){console.error('Invalid fixed API origin');process.exit(1)};import('./apps/admin/server.js')"]
