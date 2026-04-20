#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "Missing 'vercel' CLI. Install with: npm i -g vercel" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

if [ -f ".env.local" ]; then
  set -a
  . ".env.local"
  set +a
fi

SUPABASE_ONLY=false
REDEPLOY=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --supabase-only|-s)
      SUPABASE_ONLY=true
      shift
      ;;
    --redeploy)
      REDEPLOY=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [BASE_URL] [--supabase-only|-s] [--redeploy]" >&2
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

if [ ! -f ".vercel/project.json" ]; then
  echo "Linking Vercel project..."
  vercel link
fi

DEFAULT_BASE_URL="https://traegog8ouu.vercel.app"
BASE_URL="${1:-$DEFAULT_BASE_URL}"

if [ "$SUPABASE_ONLY" = false ]; then
  read -r -p "APP_BASE_URL [$BASE_URL]: " INPUT_BASE
  if [ -n "${INPUT_BASE:-}" ]; then
    BASE_URL="$INPUT_BASE"
  fi

  BASE_URL="${BASE_URL%/}"
  GOOGLE_REDIRECT_URL="$BASE_URL/api/oauth/google/callback"

  SESSION_SECRET="$(node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('base64url'))")"
  ENCRYPTION_KEY="$(node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('base64'))")"
  API_KEY_SALT="$(node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('hex'))")"
fi

echo ""
if [ "$SUPABASE_ONLY" = true ]; then
  echo "Now paste required secrets (Supabase only)." 
else
  echo "Now paste required secrets (Supabase/Google). Leave blank to skip." 
fi
echo ""

DEFAULT_SUPABASE_URL="https://gcqewencfoxpjjcinjfz.supabase.co"
SUPABASE_URL="${SUPABASE_URL:-}"
read -r -p "SUPABASE_URL [${SUPABASE_URL:-$DEFAULT_SUPABASE_URL}]: " SUPABASE_URL_INPUT
if [ -n "${SUPABASE_URL_INPUT:-}" ]; then
  SUPABASE_URL="$SUPABASE_URL_INPUT"
fi
if [ -z "${SUPABASE_URL:-}" ]; then
  SUPABASE_URL="$DEFAULT_SUPABASE_URL"
fi

SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  read -r -s -p "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
fi
echo ""
if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Received SUPABASE_SERVICE_ROLE_KEY (hidden)."
fi
if [ "$SUPABASE_ONLY" = false ]; then
  read -r -p "GOOGLE_CLIENT_ID (optional): " GOOGLE_CLIENT_ID
  read -r -s -p "GOOGLE_CLIENT_SECRET (optional): " GOOGLE_CLIENT_SECRET
  echo ""
else
  GOOGLE_CLIENT_ID=""
  GOOGLE_CLIENT_SECRET=""
fi

ENV_TARGET="production"

set_env() {
  local key="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "Skip $key (empty)"
    return 0
  fi
  vercel env rm "$key" "$ENV_TARGET" --yes >/dev/null 2>&1 || true
  printf "%s" "$value" | vercel env add "$key" "$ENV_TARGET" >/dev/null
  echo "Set $key"
}

set_env "SUPABASE_URL" "$SUPABASE_URL"
set_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
if [ "$SUPABASE_ONLY" = false ]; then
  set_env "APP_BASE_URL" "$BASE_URL"
  set_env "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
  set_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
  set_env "GOOGLE_REDIRECT_URL" "$GOOGLE_REDIRECT_URL"
  set_env "SESSION_SECRET" "$SESSION_SECRET"
  set_env "ENCRYPTION_KEY" "$ENCRYPTION_KEY"
  set_env "API_KEY_SALT" "$API_KEY_SALT"
fi

echo ""
if [ "$REDEPLOY" = true ]; then
  echo "Redeploying..."
  vercel --prod
else
  echo "Done. Redeploy to apply env vars: vercel --prod"
fi
