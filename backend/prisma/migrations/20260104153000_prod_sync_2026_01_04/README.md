Production schema sync migration generated via:
npx prisma migrate diff --from-url PROD --to-schema-datamodel prisma/schema.prisma --script
Then DROP INDEX statements were made safer with IF EXISTS.
