-- safe redefinition of Role enum
DO $$
BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'MODERATOR', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "Animal" ADD COLUMN IF NOT EXISTS "charakteristik" text;
ALTER TABLE "Animal" ADD COLUMN IF NOT EXISTS "birthDate" timestamp(3);
ALTER TABLE "Animal" ADD COLUMN IF NOT EXISTS "bornYear" integer;
