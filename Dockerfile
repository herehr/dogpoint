# Stage 1 – build
FROM node:20 AS builder

WORKDIR /app

# Copy everything needed for build
COPY package*.json tsconfig.json prisma ./ 
RUN npm install

# Copy rest of the source files
COPY . .

# Compile TypeScript and generate Prisma client
RUN npm run build
RUN npx prisma generate

# Stage 2 – production
FROM node:20

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]