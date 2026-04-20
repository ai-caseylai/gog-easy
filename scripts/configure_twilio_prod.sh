#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASH_VERSION:-}" ]; then
  echo "Please run with bash: bash ./scripts/configure_twilio_prod.sh" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Missing 'curl'" >&2
  exit 1
fi

FROM_LOCAL=false
LOCAL_STATUS_URL="http://127.0.0.1:3001/api/admin/twilio/status"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --from-local)
      FROM_LOCAL=true
      shift
      ;;
    --local-status-url)
      LOCAL_STATUS_URL="${2:-$LOCAL_STATUS_URL}"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--from-local] [--local-status-url URL]" >&2
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

BASE_URL="${BASE_URL:-https://traegog8ouu.vercel.app}"
BASE_URL="${BASE_URL%/}"

SETUP_TOKEN="${SETUP_TOKEN:-}"
ACCOUNT_SID="${TWILIO_ACCOUNT_SID:-}"
AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-}"
FROM_NUMBER="${TWILIO_FROM:-}"
MSG_SERVICE_SID="${TWILIO_MESSAGING_SERVICE_SID:-}"

if [ "$FROM_LOCAL" = true ]; then
  LOCAL_JSON=$(curl -fsS "$LOCAL_STATUS_URL" 2>/dev/null || true)
  if [ -n "${LOCAL_JSON:-}" ]; then
    LOCAL_ACCOUNT_SID=$(LOCAL_JSON="$LOCAL_JSON" node -e "try{const j=JSON.parse(process.env.LOCAL_JSON||'{}');process.stdout.write((j.accountSid||'').toString())}catch(e){}")
    LOCAL_FROM=$(LOCAL_JSON="$LOCAL_JSON" node -e "try{const j=JSON.parse(process.env.LOCAL_JSON||'{}');process.stdout.write((j.from||'').toString())}catch(e){}")
    LOCAL_MSG_SID=$(LOCAL_JSON="$LOCAL_JSON" node -e "try{const j=JSON.parse(process.env.LOCAL_JSON||'{}');process.stdout.write((j.messagingServiceSid||'').toString())}catch(e){}")

    if [ -z "${ACCOUNT_SID:-}" ] && [ -n "${LOCAL_ACCOUNT_SID:-}" ]; then
      ACCOUNT_SID="$LOCAL_ACCOUNT_SID"
    fi
    if [ -z "${FROM_NUMBER:-}" ] && [ -z "${MSG_SERVICE_SID:-}" ]; then
      if [ -n "${LOCAL_MSG_SID:-}" ]; then
        MSG_SERVICE_SID="$LOCAL_MSG_SID"
      elif [ -n "${LOCAL_FROM:-}" ]; then
        FROM_NUMBER="$LOCAL_FROM"
      fi
    fi
  fi
fi

read -r -p "BASE_URL [$BASE_URL]: " INPUT_BASE
if [ -n "${INPUT_BASE:-}" ]; then
  BASE_URL="${INPUT_BASE%/}"
fi

if [ -z "${SETUP_TOKEN:-}" ]; then
  read -r -s -p "SETUP_TOKEN (leave empty if not required): " SETUP_TOKEN
  echo ""
fi

if [ -z "${ACCOUNT_SID:-}" ]; then
  read -r -p "TWILIO_ACCOUNT_SID: " ACCOUNT_SID
else
  read -r -p "TWILIO_ACCOUNT_SID [$ACCOUNT_SID]: " ACCOUNT_SID_INPUT
  if [ -n "${ACCOUNT_SID_INPUT:-}" ]; then
    ACCOUNT_SID="$ACCOUNT_SID_INPUT"
  fi
fi

if [ -z "${AUTH_TOKEN:-}" ]; then
  read -r -s -p "TWILIO_AUTH_TOKEN: " AUTH_TOKEN
  echo ""
fi

if [ -z "${FROM_NUMBER:-}" ] && [ -z "${MSG_SERVICE_SID:-}" ]; then
  echo "Choose sender config (one required):"
  echo "  1) From (E.164 / Sender ID)"
  echo "  2) Messaging Service SID"
  read -r -p "> " CHOICE
  if [ "${CHOICE:-}" = "2" ]; then
    read -r -p "TWILIO_MESSAGING_SERVICE_SID: " MSG_SERVICE_SID
  else
    read -r -p "TWILIO_FROM (e.g. +852... or Sender ID): " FROM_NUMBER
  fi
else
  if [ -n "${MSG_SERVICE_SID:-}" ]; then
    read -r -p "TWILIO_MESSAGING_SERVICE_SID [$MSG_SERVICE_SID]: " MSG_SERVICE_SID_INPUT
    if [ -n "${MSG_SERVICE_SID_INPUT:-}" ]; then
      MSG_SERVICE_SID="$MSG_SERVICE_SID_INPUT"
    fi
  else
    read -r -p "TWILIO_FROM [$FROM_NUMBER]: " FROM_NUMBER_INPUT
    if [ -n "${FROM_NUMBER_INPUT:-}" ]; then
      FROM_NUMBER="$FROM_NUMBER_INPUT"
    fi
  fi
fi

if [ -z "${ACCOUNT_SID:-}" ]; then
  echo "TWILIO_ACCOUNT_SID is empty" >&2
  exit 1
fi
if [ -z "${AUTH_TOKEN:-}" ]; then
  echo "TWILIO_AUTH_TOKEN is empty" >&2
  exit 1
fi
if [ -z "${FROM_NUMBER:-}" ] && [ -z "${MSG_SERVICE_SID:-}" ]; then
  echo "Either TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID is required" >&2
  exit 1
fi

JSON_PAYLOAD=$(ACCOUNT_SID="$ACCOUNT_SID" AUTH_TOKEN="$AUTH_TOKEN" FROM_NUMBER="$FROM_NUMBER" MSG_SERVICE_SID="$MSG_SERVICE_SID" SETUP_TOKEN="$SETUP_TOKEN" node -e "
  const payload = {
    setupToken: process.env.SETUP_TOKEN || undefined,
    accountSid: process.env.ACCOUNT_SID,
    authToken: process.env.AUTH_TOKEN,
    from: process.env.FROM_NUMBER || null,
    messagingServiceSid: process.env.MSG_SERVICE_SID || null,
  };
  process.stdout.write(JSON.stringify(payload));
" )

HTTP_CODE=$(curl -sS -o /tmp/twilio_save.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/admin/twilio/save" \
  -H "Content-Type: application/json" \
  ${SETUP_TOKEN:+-H "x-setup-token: $SETUP_TOKEN"} \
  --data "$JSON_PAYLOAD")

if [ "$HTTP_CODE" != "200" ]; then
  if [ "$HTTP_CODE" = "401" ] && grep -q '"error":"UNAUTHORIZED"' /tmp/twilio_save.json 2>/dev/null; then
    echo "Failed to save Twilio config (HTTP 401 UNAUTHORIZED)" >&2
    if [ -z "${SETUP_TOKEN:-}" ]; then
      echo "Hint: This endpoint requires SETUP_TOKEN in production." >&2
      echo "- Ensure you ran: vercel env add SETUP_TOKEN production && vercel --prod" >&2
      echo "- Re-run this script and paste the same SETUP_TOKEN when prompted." >&2
    else
      echo "Hint: SETUP_TOKEN is incorrect or deployment has not picked up env vars yet." >&2
      echo "- Re-deploy: vercel --prod" >&2
    fi
    cat /tmp/twilio_save.json >&2 || true
    exit 1
  fi
  echo "Failed to save Twilio config (HTTP $HTTP_CODE)" >&2
  cat /tmp/twilio_save.json >&2 || true
  exit 1
fi

echo "Twilio config saved." 
echo "Optional test:"
echo "  curl -sS -X POST $BASE_URL/api/admin/twilio/test-sms -H 'Content-Type: application/json' \\"
echo "    ${SETUP_TOKEN:+-H 'x-setup-token: ***'} \\"
echo "    --data '{\"setupToken\":\"***\",\"to\":\"+852...\",\"body\":\"Test\"}'"
