# -------- Step 1: Build Layer --------
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci
RUN npm install typescript prisma

# Copy the full app (includes src/, prisma/, etc.)
COPY . .

# Optional: explicitly copy Prisma schema if not already included above
# COPY prisma ./prisma

# Build Prisma client
RUN npx prisma generate

# Transpile TypeScript
RUN npm run build


# -------- Step 2: Runtime Layer --------
FROM node:18-alpine

WORKDIR /app

# Copy only the essentials for runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma

# You can optionally include .env for debugging (omit in production if secrets are managed by DO)
# COPY --from=build /app/.env ./

EXPOSE 3000

# Start the app
CMD ["node", "dist/index.js"]