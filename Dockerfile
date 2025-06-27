# Stage 1: Build
FROM node:20 as build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20

WORKDIR /app
COPY --from=build /app /app
RUN npm install --omit=dev
CMD ["npm", "start"]