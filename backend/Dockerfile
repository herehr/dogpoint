# Use Node.js 18 Alpine as the base image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the TypeScript project
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the application: migrate, seed, then run
CMD ["sh", "-c", "npx prisma migrate deploy && echo '🧪 Migrated'; npm run seed && echo '🌱 Seed complete'; npm start"]