# syntax=docker/dockerfile:1
# Node 24/Debian 13 matches the workspace and shares native binary ABI.
# Release workflow must eventually pin a reviewed base by immutable digest.
ARG NODE_BASE_IMAGE=node:24-trixie-slim
FROM ${NODE_BASE_IMAGE} AS base
WORKDIR /workspace
ENV HUSKY=0
RUN npm install --global pnpm@12.18.0 --no-audit --no-fund

FROM base AS build
# Build context is the repository root (not apps/api).
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gym/api db:generate && pnpm --filter @gym/api build

# Migration image intentionally carries Prisma CLI/schema, unlike runtime.
FROM build AS migrate
ENV NODE_ENV=production
WORKDIR /workspace/apps/api
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]

# pnpm 12 deploy creates a self-contained isolated production dependency tree.
# Built dist/ is copied explicitly: the repository gitignore excludes it.
FROM build AS production-deps
RUN pnpm --filter @gym/api --prod deploy /app/pruned

FROM ${NODE_BASE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    AVATAR_STORAGE_DIR=/app/uploads/avatars
WORKDIR /app
COPY --from=production-deps /app/pruned/ ./
COPY --from=build /workspace/apps/api/dist/ ./dist/
RUN mkdir -p /app/uploads/avatars && chown -R node:node /app/uploads
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "const c=new AbortController();setTimeout(()=>c.abort(),3000).unref();fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready',{signal:c.signal}).then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
