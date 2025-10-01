# ---------- Stage 1: Build ----------
FROM node:20.19.0 AS builder
WORKDIR /app

# 1) install with lockfile (reproducible)
COPY package*.json ./
RUN npm ci

# 2) copy source and prisma schema+migrations (+ prisma.config.ts)
COPY tsconfig.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src

# 3) generate Prisma client BEFORE TypeScript build (types rely on it)
RUN npx prisma generate

# 4) build TS
RUN npm run build


# ---------- Stage 2: Production ----------
FROM node:20.19.0 AS runner
WORKDIR /app
ENV NODE_ENV=production

# ✅ Bring the Node modules (including devDeps like prisma CLI) from builder
COPY --from=builder /app/node_modules ./node_modules

# ✅ Copy app artifacts & Prisma files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# (no npm ci here; we already copied node_modules)

# Optional: (re)generate client in runtime layer — safe to skip if already generated
# RUN npx prisma generate

# Run migrations on start, then launch server
CMD ["sh", "-c", "npm run migrate:deploy && node dist/index.js"]

# Optional container-level healthcheck (App Platform health path can also hit /healthz)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
#   CMD node -e "require('http').get('http://127.0.0.1:8080/healthz', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"