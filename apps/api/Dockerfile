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
# Only dependency manifests affect the install layer. Keep paths intact so
# pnpm can resolve the entire workspace graph when API dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json tooling/*/package.json ./
RUN pnpm --filter @gym/api... install --frozen-lockfile
# Source edits now invalidate compilation, not the dependency install layer.
COPY . .
# Verify the API-only context before producing either deployable image.
RUN echo 'Docker context: API Prisma config' \
    && test -f apps/api/prisma7.config.ts \
    && echo 'Docker context: API src' \
    && test -d apps/api/src \
    && echo 'Docker context: Prisma migrations' \
    && test -d apps/api/prisma/migrations \
    && echo 'Docker context: Web workspace manifest' \
    && test -f apps/web/package.json \
    && echo 'Docker context: i18n workspace manifest' \
    && test -f packages/i18n/package.json \
    && echo 'Docker context: domain runtime and types' \
    && test -f packages/domain/src/index.js \
    && test -f packages/domain/src/index.d.ts \
    && test -f packages/datetime/src/index.js \
    && test -f packages/datetime/src/index.d.ts \
    && echo 'Docker context: Web src excluded' \
    && test ! -e apps/web/src \
    && echo 'Docker context: Mobile src excluded' \
    && test ! -e apps/mobile/src \
    && echo 'Docker context: i18n src excluded' \
    && test ! -e packages/i18n/src
RUN pnpm --filter @gym/api db:generate && pnpm --filter @gym/api build

# Deploy only the API workspace with its migration tooling. Unlike the full
# build stage, the migration image must not contain unrelated web/mobile deps.
FROM build AS migration-deps
RUN pnpm --filter @gym/api deploy /app/migrate

FROM ${NODE_BASE_IMAGE} AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=migration-deps /app/migrate/ ./
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
