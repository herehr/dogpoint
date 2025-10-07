ARG NODE_VERSION=20.12.2

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
ENV CI=true \
    NODE_ENV=development \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) \
 && echo "[deps] deps installed."

# 👇 copy prisma to /app/prisma (not src/prisma)
COPY src/prisma ./prisma
# 👇 generate with the same path
RUN npx prisma generate --schema=./prisma/schema.prisma

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

COPY package.json ./
COPY package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 👇 have prisma in /app/prisma at runtime too
COPY src/prisma ./prisma

EXPOSE 8080
# CMD ["npm", "run", "start:with-migrate"]