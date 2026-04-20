#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "Missing 'vercel' CLI. Install with: npm i -g vercel" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

if [ ! -f ".vercel/project.json" ]; then
  echo "Linking Vercel project..."
  vercel link
fi

ENV_TARGET="production"

SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  read -r -s -p "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
  echo ""
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is empty; abort." >&2
  exit 1
fi

vercel env rm "SUPABASE_SERVICE_ROLE_KEY" "$ENV_TARGET" --yes >/dev/null 2>&1 || true
printf "%s" "$SUPABASE_SERVICE_ROLE_KEY" | vercel env add "SUPABASE_SERVICE_ROLE_KEY" "$ENV_TARGET" >/dev/null

echo "Set SUPABASE_SERVICE_ROLE_KEY ($ENV_TARGET)."
echo "Redeploy to apply env vars: vercel --prod"

