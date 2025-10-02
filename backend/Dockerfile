# backend/Dockerfile
ARG NODE_VERSION=20.12.2

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
ENV CI=true \
    NODE_ENV=development \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true
WORKDIR /app

# explicit copies (no globs)
COPY package.json ./
COPY package-lock.json ./
RUN (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) \
 && echo "[deps] deps installed."

# generate Prisma Client into THIS stage's node_modules
COPY prisma ./prisma
RUN echo "[deps] prisma generate..." \
 && npx prisma generate --schema=./prisma/schema.prisma \
 && echo "[deps] prisma generate done."

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN echo "[builder] tsc..." && npx tsc && echo "[builder] build done."

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# npm run needs package files present
COPY package.json ./
COPY package-lock.json ./

# runtime deps (already have generated @prisma/client)
COPY --from=deps /app/node_modules ./node_modules

# app artifacts
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
# If you use prisma.config.ts, copy it too:
# COPY prisma.config.ts ./prisma.config.ts

EXPOSE 8080
# DO run command: npm run start:with-migrate
# (optional default)
# CMD ["npm", "run", "start:with-migrate"]