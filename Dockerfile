# Stage 1: Build
FROM node:20.19.0 AS builder

WORKDIR /app

# Copy only what's needed for install/build
COPY package*.json tsconfig.json ./
COPY prisma ./prisma
COPY ./src ./src

# Install & build
RUN npm install
RUN npm run build
RUN npx prisma generate
RUN npm install -g npm@11.4.2

# Stage 2: Production
FROM node:20.19.0

WORKDIR /app

# Copy production build and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]