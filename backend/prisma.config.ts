import * as path from 'node:path'
import * as dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

const envFile = process.env.PRISMA_ENV_FILE || '.env'
dotenv.config({ path: path.resolve(__dirname, envFile) })

export default defineConfig({
  schema: './prisma/schema.prisma',
})