# backend/Dockerfile
# Multi-stage build: deterministic, Prisma-safe (no watch), Node 20.12.2

ARG NODE_VERSION=20.12.2

# ---------- base ----------
FROM node:${NODE_VERSION}-alpine AS base
ENV CI=true \
    NODE_ENV=production \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true \
    PRISMA_GENERATE_WATCH=
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN echo "[deps] npm ci..." && npm ci --no-audit --no-fund && echo "[deps] done."

# ---------- builder ----------
FROM deps AS builder
# Copy prisma first; generate client BEFORE TS build so types exist
COPY prisma ./prisma
RUN echo "[builder] prisma generate..." \
 && npx prisma generate --schema=./prisma/schema.prisma \
 && echo "[builder] prisma generate done."

# Copy tsconfig + sources, then build
COPY tsconfig.json tsconfig.json
COPY src ./src
RUN echo "[builder] tsc..." && npx tsc && echo "[builder] build done."

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# Copy runtime deps and built files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 8080
CMD node dist/index.js