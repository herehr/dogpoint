// backend/prisma.config.ts
import { defineConfig } from '@prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  seed: 'ts-node prisma/seed.ts',

  // Ensures Prisma loads env vars from backend/.env by default.
  // You can temporarily swap the file during baseline steps (see commands below).
  dotenv: { path: './.env' },
})