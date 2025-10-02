# backend/Dockerfile
ARG NODE_VERSION=20.12.2

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
ENV CI=true \
    NODE_ENV=development \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true
WORKDIR /app

# Only package files first (better cache)
COPY package.json package-lock.json ./
RUN echo "[deps] npm ci..." && npm ci --no-audit --no-fund && echo "[deps] done."

# Copy prisma and generate client into THIS stage's node_modules
COPY prisma ./prisma
RUN echo "[deps] prisma generate..." \
 && npx prisma generate --schema=./prisma/schema.prisma \
 && echo "[deps] prisma generate done."

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# Reuse deps (including generated @prisma/client)
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json tsconfig.json
COPY src ./src
RUN echo "[builder] tsc..." && npx tsc && echo "[builder] build done."

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# Copy runtime deps WITH the generated Prisma client
COPY --from=deps /app/node_modules ./node_modules
# App files
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 8080
CMD node dist/index.js