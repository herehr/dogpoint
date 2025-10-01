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

# 3) generate Prisma client BEFORE TypeScript build (types rely on it)
RUN npx prisma generate

# 4) build TS
RUN npm run build

# ---------- Stage 2: Production ----------
FROM node:20.19.0 AS runner
WORKDIR /app
ENV NODE_ENV=production

# 1) copy prisma FIRST so schema exists during install/generate
COPY --from=builder /app/prisma ./prisma

# 2) install prod-only deps (no postinstall anymore)
COPY package*.json ./
RUN npm ci --omit=dev

# 3) generate Prisma client in the runtime image
RUN npx prisma generate

# 4) copy compiled app
COPY --from=builder /app/dist ./dist

# 5) run migrations on start, then launch server
CMD ["sh", "-c", "npm run migrate:deploy && node dist/index.js"]