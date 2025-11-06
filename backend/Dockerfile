ARG NODE_VERSION=20.12.2

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
ENV CI=true \
    NODE_ENV=development \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true
WORKDIR /app

# system deps (one layer)
RUN apk add --no-cache ffmpeg libc6-compat

# install deps
COPY package.json package-lock.json ./
RUN (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) \
 && echo "[deps] deps installed."

# prisma: your schema lives in src/prisma
COPY src/prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# bring deps + source
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./tsconfig.json
COPY src ./src

# sanity: schema must exist
RUN test -f ./src/prisma/schema.prisma

# compile TS → dist
RUN echo "[builder] tsc..." && npx tsc && echo "[builder] build done."

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# keep prisma folder available at runtime (for migrate or schema ref)
COPY src/prisma ./prisma

EXPOSE 8080
# If DO App Platform is configured with a Run Command, keep CMD commented.
# Otherwise, uncomment one of these:
# CMD ["node", "dist/index.js"]
# CMD ["npm", "run", "start:with-migrate"]