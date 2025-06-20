# -------- Step 1: Build Layer --------
FROM node:18-alpine AS build
# ^ this layer compiles TypeScript and generates Prisma client

WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npm install typescript prisma
COPY . .
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate
RUN npm run build


# -------- Step 2: Runtime Layer --------
FROM node:18-alpine
# ^ this layer runs the final app — smaller and faster

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]