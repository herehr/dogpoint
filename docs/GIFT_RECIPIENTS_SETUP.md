# Gift Recipients – Setup & Testing

## 1. Run the migration

The feature adds a `SubscriptionGiftRecipient` table. Run the migration when your database is reachable:

**Production / remote DB:**
```bash
cd backend && npm run migrate:deploy
```

**Local dev (Docker PostgreSQL on port 55432):**
```bash
# 1. Start local DB
docker compose -f docker-compose.dev-db.yml up -d

# 2. Ensure backend/.env has:
#    DATABASE_URL=postgresql://postgres:postgres@localhost:55432/dogpoint_dev

# 3. Run migration
cd backend && npm run migrate:deploy
```

## 2. Verify the migration

```bash
cd backend && npx prisma migrate status
```

You should see `20260304120000_add_subscription_gift_recipient` as applied.

## 3. Invite email

When a subscriber adds a gift recipient, an invite email is sent automatically (if SMTP is configured). The email tells the recipient they've been gifted an adoption and links to the login page.

## 4. Test the flow

1. **As subscriber (patron):**
   - Log in and go to "Moje adopce" (User Dashboard)
   - Click the gift icon on an adoption card
   - Add a gift recipient by email (e.g. `friend@example.com`)
   - Optionally add a display name

2. **As the gift recipient:**
   - Register or log in with the invited email
   - Go to "Moje adopce" – the adopted animal should appear
   - Open the animal detail – posts should be visible (unlocked)
   - New post notifications will be sent to the gift recipient

3. **Limits:**
   - Max 5 gift recipients per adoption
   - Only the subscriber can add/remove recipients
   - Gift recipients see posts only (no payments, no subscription management)
