# backend/Dockerfile
ARG NODE_VERSION=20.12.2

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
ENV CI=true \
    NODE_ENV=development \
    PRISMA_SKIP_POSTINSTALL_GENERATE=true
WORKDIR /app

# Copy package files explicitly (no patterns)
COPY package.json ./
COPY package-lock.json ./
RUN (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) \
 && echo "[deps] deps installed."

# Generate Prisma Client into THIS stage's node_modules
COPY prisma ./prisma
RUN echo "[deps] prisma generate..." \
 && npx prisma generate --schema=./prisma/schema.prisma \
 && echo "[deps] prisma generate done."

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# Use deps with generated @prisma/client
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN echo "[builder] tsc..." && npx tsc && echo "[builder] build done."

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# (1) package files are required because we run `npm run ...` in the container
COPY package.json ./
COPY package-lock.json ./

# (2) runtime deps (already contain the generated @prisma/client)
COPY --from=deps /app/node_modules ./node_modules

# (3) app artifacts
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
# If you use prisma.config.ts, also copy it:
# COPY prisma.config.ts ./prisma.config.ts

# Debug aid: list what made it into the image (leave in until stable)
RUN echo "[runner] tree:" && ls -la /app && echo "---" && ls -la /app/dist && echo "---" && ls -la /app/prisma

EXPOSE 8080
# DO App Platform run command: npm run start:with-migrate
# If you want a default inside the image, uncomment:
# CMD ["npm", "run", "start:with-migrate"]