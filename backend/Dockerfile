# Use Node.js 18 Alpine as the base image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci
RUN npm install typescript@latest

# Copy everything else
COPY . .

# Make wait-for script executable
RUN chmod +x wait-for.sh

# Generate Prisma client
RUN npx prisma generate

# Print TypeScript version (diagnostic)
RUN npx tsc --version

# Build the TypeScript project
RUN npm run build

# Expose port
EXPOSE 3000

# Debug-aware CMD for DO App Platform
CMD ["./wait-for.sh", "db:5432", "--", "sh", "-c", "echo '📦 DB ready'; npx prisma migrate deploy && echo '🧪 Migrated'; npm run seed && echo '🌱 Seed complete'; npm start"]