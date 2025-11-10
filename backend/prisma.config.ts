import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config'

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  schema: './prisma/schema.prisma',
})
