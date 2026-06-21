# Hanzo Market — web (TanStack Start + Nitro) + API (Hono).
#
# Base is NOT in this image: it runs as a sidecar container in the same pod
# (ghcr.io/hanzoai/base), reachable over loopback. The market collection
# schema ships as a k8s ConfigMap mounted into that sidecar, not baked here.

# ─── Stage 1: Build API ──────────────────────────────────────────────────────
FROM node:22-slim AS api-build
WORKDIR /app/api
COPY api/package.json api/tsconfig.json ./
RUN npm install --production=false
COPY api/src ./src
RUN npx tsc

# ─── Stage 2: Build Web (TanStack Start + Nitro) ────────────────────────────
FROM oven/bun:1 AS web-build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ ./packages/
RUN bun install --frozen-lockfile
COPY . .
ENV VITE_API_URL=/api
RUN bun --bun run build

# ─── Stage 3: Production ────────────────────────────────────────────────────
FROM oven/bun:1 AS production
WORKDIR /app

# API server
COPY --from=api-build /app/api/dist ./api/dist
COPY --from=api-build /app/api/package.json ./api/
COPY --from=api-build /app/api/node_modules ./api/node_modules

# Web build
COPY --from=web-build /app/.output ./.output

# Startup script (launches web + API; Base is the sidecar)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001
ENV WEB_PORT=3000

EXPOSE 3000 3001

ENTRYPOINT ["/docker-entrypoint.sh"]
