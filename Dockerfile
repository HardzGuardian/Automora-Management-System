# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js standalone output. Build:  docker build -t automora .
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders only; real values are injected at runtime (see docs/11-deployment.md).
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-build-time-placeholder \
    BETTER_AUTH_URL=http://localhost:3000 \
    APP_URL=http://localhost:3000 \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# One-off migration image (needs dev tooling): docker build --target migrate -t automora-migrate .
#   docker run --rm -e DATABASE_URL=... automora-migrate
FROM build AS migrate
CMD ["pnpm", "db:migrate"]

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
