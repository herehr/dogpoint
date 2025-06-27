# Stage 1 – Build
FROM node:18.20.2 AS builder

WORKDIR /app

# Copy install files and install dependencies
COPY package*.json tsconfig.json prisma ./
RUN npm install

# Copy source files
COPY ./src ./src

# Build TypeScript and generate Prisma client
RUN npm run build
RUN npx prisma generate

# Stage 2 – Production
FROM node:18.20.2

WORKDIR /app

# Copy only the built app and runtime deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]