# Use Node.js 18 Alpine as the base image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the app:
# 1. Generate Prisma client AFTER environment is available
# 2. Run migrations and seed (only at runtime)
# 3. Start the server
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && echo '🧪 Migrated'; npm run seed && echo '🌱 Seed complete'; npm start"]