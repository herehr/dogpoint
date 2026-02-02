ARG NODE_VERSION=20.12.2

# ---------- deps ----------
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


# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY prisma ./prisma

# compile TS → dist
RUN echo "[builder] tsc..." && npx tsc && echo "[builder] build done."


# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# ✅ Runtime system deps
# ffmpeg = media
# chromium + fonts = puppeteer-core PDF rendering
RUN apk add --no-cache \
    ffmpeg \
    libc6-compat \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteer expects this path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 8080

# DO App Platform usually defines the run command itself
# CMD ["npm", "run", "start:with-migrate"]