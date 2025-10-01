# ---------- Stage 1: Build ----------
FROM node:20.19.0 AS builder
WORKDIR /app

# 1) install with lockfile (reproducible)
COPY package*.json ./
RUN npm ci

# 2) copy source and prisma schema+migrations
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# 3) build TS and generate Prisma client
RUN npm run build
RUN npx prisma generate

# ---------- Stage 2: Production ----------
FROM node:20.19.0 AS runner
WORKDIR /app
ENV NODE_ENV=production

# 1) install prod-only deps
COPY package*.json ./
RUN npm ci --omit=dev

# 2) copy compiled app + prisma (schema + migrations)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# (optional) generate again — usually not needed because @prisma/client was generated in builder.
# RUN npx prisma generate

# health: show version on startup if you want
# CMD ["sh", "-c", "node -e \"console.log('Backend up')\" && node dist/index.js"]
CMD ["sh", "-c", "npm run migrate:deploy && node dist/index.js"]