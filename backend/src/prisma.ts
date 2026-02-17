import { PrismaClient } from '@prisma/client';

// DO Managed PostgreSQL: ensure connection_limit + sslmode (avoids pool exhaustion, SSL required)
function ensureDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const hasParams = url.includes('?');
  const params: string[] = [];
  if (!url.includes('connection_limit')) params.push('connection_limit=5');
  if (!url.includes('sslmode')) params.push('sslmode=require');
  if (params.length) {
    process.env.DATABASE_URL = url + (hasParams ? '&' : '?') + params.join('&');
  }
}
ensureDatabaseUrl();

// Log connection type for DO debugging (pool=25061 recommended, direct=25060)
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const m = dbUrl.match(/:(\d+)\//);
  const port = m ? m[1] : '?';
  console.log(`[DB] DATABASE_URL port=${port} (25061=pool recommended, 25060=direct)`);
}

export const prisma = new PrismaClient();
process.on('beforeExit', async () => { await prisma.$disconnect(); });
