# === 0) Run this from your repo root (folder containing frontend/ and backend/) ===
# cd /path/to/adopt

# Stop on first error
set -euo pipefail

# Timestamp + backup dir
DATE="$(date +'%Y-%m-%d_%H-%M-%S')"
BACKUP_DIR="$PWD/_backup/$DATE"
mkdir -p "$BACKUP_DIR"

echo "→ Backing up to: $BACKUP_DIR"

# === 1) Save current git state (optional but recommended) ===
echo "→ Saving git patch of uncommitted changes"
git diff > "$BACKUP_DIR/git-diff-$DATE.patch" || true
git status --porcelain > "$BACKUP_DIR/git-status-$DATE.txt" || true
git rev-parse --short HEAD > "$BACKUP_DIR/git-commit-$DATE.txt" || true

# === 2) Archive frontend & backend (exclude heavy/build stuff) ===
echo "→ Archiving frontend"
tar -czf "$BACKUP_DIR/frontend-$DATE.tgz" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.turbo' \
  --exclude='.cache' \
  -C "$PWD" frontend

echo "→ Archiving backend"
tar -czf "$BACKUP_DIR/backend-$DATE.tgz" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.cache' \
  -C "$PWD" backend

# Also save .env files if present (they’re not in tars by default)
echo "→ Copying .env files (if any)"
[ -f frontend/.env ] && cp frontend/.env "$BACKUP_DIR/frontend.$DATE.env"
[ -f backend/.env ] && cp backend/.env "$BACKUP_DIR/backend.$DATE.env"

# === 3) Quick file-level rsync mirror (useful for eyeballing) ===
echo "→ Creating a browsable mirror (no node_modules, no build)"
mkdir -p "$BACKUP_DIR/mirror"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.next' \
  --exclude '.turbo' \
  --exclude '.cache' \
  ./ "$BACKUP_DIR/mirror/"

# === 4) OPTIONAL: Local Postgres dump (pick one of the two) ===
# 4a) If Postgres runs on your mac (port 5432):
# pg_dump --no-owner --no-privileges \
#   -h localhost -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME \
#   -f "$BACKUP_DIR/db-local-$DATE.sql"

# 4b) If DB runs in Docker (container named dogpoint_db, port 5432 inside):
# docker exec -i dogpoint_db pg_dump -U dogpoint -d dogpoint > "$BACKUP_DIR/db-docker-$DATE.sql"

echo "✅ Backup complete."
echo "Files:"
ls -lh "$BACKUP_DIR"
