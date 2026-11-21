#!/usr/bin/env bash
# Production iOS IPA (macOS + Xcode). Requires ios/Flutter/Signing.xcconfig with DEVELOPMENT_TEAM.
# Usage (from apps/mobile):
#   ./scripts/build-prod-ios.sh
set -euo pipefail
MOBILE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_ROOT/../.." && pwd)"
cd "$MOBILE_ROOT"

load_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="$(echo "$key" | xargs)"
    export "ENV_$key=$val"
  done < "$f"
}

load_env "$REPO_ROOT/.env"
load_env "$REPO_ROOT/apps/web/.env.vercel"

API_ORIGIN="${ENV_DAMA_PUBLIC_API_BASE:-}"
if [[ -z "$API_ORIGIN" && -n "${ENV_NEXT_PUBLIC_REST_URL:-}" ]]; then
  API_ORIGIN="${ENV_NEXT_PUBLIC_REST_URL%/}"
  API_ORIGIN="${API_ORIGIN%/api/v1}"
fi
API_ORIGIN="${API_ORIGIN%/}"
WEB_ORIGIN="${ENV_NEXT_PUBLIC_SITE_URL:-}"
WEB_ORIGIN="${WEB_ORIGIN%/}"
SUPABASE_URL="${ENV_NEXT_PUBLIC_SUPABASE_URL:-${ENV_SUPABASE_URL:-}}"
SUPABASE_ANON="${ENV_NEXT_PUBLIC_SUPABASE_ANON_KEY:-${ENV_SUPABASE_ANON_KEY:-}}"

[[ -n "$API_ORIGIN" ]] || { echo "DAMA_API_ORIGIN missing"; exit 1; }
[[ -n "$SUPABASE_URL" && -n "$SUPABASE_ANON" ]] || { echo "Supabase env missing"; exit 1; }
[[ -f ios/Flutter/Signing.xcconfig ]] || echo "WARN: ios/Flutter/Signing.xcconfig missing (copy from .example)"

DEFINES=(
  --dart-define="DAMA_API_ORIGIN=$API_ORIGIN"
  --dart-define="DAMA_SUPABASE_URL=$SUPABASE_URL"
  --dart-define="DAMA_SUPABASE_ANON_KEY=$SUPABASE_ANON"
)
[[ -n "$WEB_ORIGIN" ]] && DEFINES+=(--dart-define="DAMA_WEB_ORIGIN=$WEB_ORIGIN")

flutter pub get
flutter build ipa --release "${DEFINES[@]}"
echo "IPA under build/ios/ipa/"
