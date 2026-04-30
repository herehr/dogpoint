#!/bin/bash
# Sync Stripe payments into Payment table
# Usage: ./scripts/stripe-sync-payments.sh <API_BASE_URL> <ADMIN_JWT>
# Example: ./scripts/stripe-sync-payments.sh https://dp-backend-3vysi.ondigitalocean.app eyJhbGc...

set -e
API="${1:-}"
TOKEN="${2:-}"

if [ -z "$API" ] || [ -z "$TOKEN" ]; then
  echo "Usage: $0 <API_BASE_URL> <ADMIN_JWT>"
  echo ""
  echo "To get your admin JWT:"
  echo "  1. Log in to the app as admin"
  echo "  2. Open DevTools (F12) → Application → Local Storage"
  echo "  3. Copy 'adminToken' or 'accessToken'"
  echo ""
  echo "Example: $0 https://your-dev-api.example.com eyJhbGciOiJIUzI1NiIs..."
  exit 1
fi

API="${API%/}"
echo "Calling ${API}/api/admin/stripe-sync-payments ..."
curl -s -X POST "${API}/api/admin/stripe-sync-payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq . || cat
