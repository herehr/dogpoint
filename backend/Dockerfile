ARG NODE_VERSION=20.12.2

# ─────────────────────────────────────────────
# deps
# ─────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
ENV CI=true \
    NODE_ENV=development \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true

WORKDIR /app

# system deps (needed for prisma + node-gyp compatibility)
RUN apk add --no-cache libc6-compat

# install deps
COPY package.json package-lock.json ./
RUN (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) \
  && echo "[deps] deps installed."

# prisma
COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma


# ─────────────────────────────────────────────
# builder
# ─────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY prisma ./prisma
COPY assets ./assets

# compile TS → dist
RUN echo "[builder] tsc..." && npx tsc && echo "[builder] build done."


# ─────────────────────────────────────────────
# runner (production)
# ─────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# ✅ Runtime deps
# chromium + dejavu = PDF + QR working
RUN apk add --no-cache \
    ffmpeg \
    libc6-compat \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-dejavu \
    fontconfig

# Puppeteer expects this path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY prisma ./prisma

# Own files for non-root user (node:alpine has uid 1000)
RUN chown -R node:node /app

EXPOSE 8080

# Run as non-root (avoids permission issues with DB)
USER node

# Use node directly - no migrations (DO Managed DB user lacks SUPERUSER for prisma migrate).
# Run migrations manually: npx prisma migrate deploy --schema=./prisma/schema.prisma
CMD ["node", "dist/index.js"]