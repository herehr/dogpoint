# Use Node.js 18 Alpine as the base image
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

# Generate Prisma client, apply migrations, seed DB, then start server
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && echo '🧪 Migrated'; npm run seed && echo '🌱 Seed complete'; npm start"]