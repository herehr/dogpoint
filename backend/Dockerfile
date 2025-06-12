# Use Node.js 18 Alpine as the base image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci
RUN npm install typescript@latest

# Copy the rest of the application code
COPY . .

RUN npx prisma generate

# Print TypeScript version (diagnostic)
RUN npx tsc --version

# Build the TypeScript code
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["./waitfor.sh", "db:5432", "--", "sh", "-c", "echo '📦 DB ready'; npx prisma migrate deploy && echo '🧪 Migrated'; npm run seed && echo '🌱 Seed completed'; npm start"]