#!/bin/sh
# Smoke check of a deployed site, curl only and read-only: it never creates a Stripe session, an
# order, a review or an enquiry. Run by .github/workflows/post-deploy.yml; runnable by hand:
#
#   sh ops/smoke-test.sh                                    # https://astarcustoms.com
#   SMOKE_HEALTH_WAIT=0 SMOKE_SKIP_WWW=1 sh ops/smoke-test.sh http://localhost:8080
#
# Environment (all optional):
#   SMOKE_HEALTH_WAIT  seconds to keep retrying /api/health while a deploy settles (default: 180)
#   SMOKE_SKIP_WWW     1 skips the www -> apex redirect check (for localhost or a preview domain)
#
# Prints PASS/FAIL per check and exits non-zero if any check fails.

set -eu

base=${1:-https://astarcustoms.com}
base=${base%/}
case "$base" in
  http://* | https://*) ;;
  *) echo "Not an http(s) URL: $base" >&2; exit 2 ;;
esac
case "$base" in
  *[!A-Za-z0-9:/._-]*) echo "Unexpected characters in the URL" >&2; exit 2 ;;
esac
health_wait=${SMOKE_HEALTH_WAIT:-180}
skip_www=${SMOKE_SKIP_WWW:-0}
origin=$(printf '%s\n' "$base" | sed -E 's#^(https?://[^/]+).*#\1#')

# A product that exists in the catalogue (frontend/src/data/catalog.json) and its page.
product_id=prod_01KS68E0X8NM8FT2FXN6S0YXCF
product_page=/mercedes-c-class-oem-ambient-lighting
product_title="Mercedes C-Class W205/C205 OEM Ambient Lighting"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() {
  printf 'FAIL  %s: %s\n' "$1" "$2"
  failures=$((failures + 1))
}

# request METHOD URL [curl options]: sets $status and $location; the body is in $tmp/body.
# Never follows redirects, so every check sees the site's own answer.
request() {
  method=$1 url=$2
  shift 2
  : >"$tmp/headers"
  : >"$tmp/body"
  status=$(curl -sS --max-time 20 -X "$method" -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' "$@" "$url" 2>"$tmp/error") || status=000
  location=$(sed -n 's/^[Ll]ocation:[[:space:]]*//p' "$tmp/headers" | tr -d '\r' | tail -n 1)
}

expect_status() { # LABEL EXPECTED
  if [ "$status" = "$2" ]; then pass "$1 = $2"; else fail "$1" "expected $2, got $status $(head -c 200 "$tmp/error" | tr '\n' ' ')"; fi
}

echo "Smoke check of $base"

# 1. Health: the new deploy may still be starting, so retry.
deadline=$(($(date +%s) + health_wait))
while :; do
  request GET "$base/api/health"
  body=$(tr -d ' \r\n' <"$tmp/body")
  if [ "$status" = 200 ] && [ "$body" = '{"status":"ok"}' ]; then
    pass "GET /api/health = 200 $body"
    break
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    fail "GET /api/health" "expected 200 {\"status\":\"ok\"}, got $status $(printf '%s' "$body" | head -c 200)"
    break
  fi
  sleep 10
done

# 2. Key pages (the SPA shell; nginx falls back to index.html for client routes).
for page in / "$product_page" /shop /contact-us /checkout; do
  request GET "$base$page"
  if [ "$status" = 200 ] && grep -q '<div id="root">' "$tmp/body"; then
    pass "GET $page = 200 (storefront shell)"
  else
    fail "GET $page" "expected 200 with the storefront shell, got $status"
  fi
done

# 3. www redirects permanently to the apex domain.
if [ "$skip_www" = 1 ]; then
  echo "SKIP  www -> apex redirect (SMOKE_SKIP_WWW=1)"
else
  www=$(printf '%s\n' "$origin" | sed -E 's#^(https?://)#\1www.#')
  request GET "$www/"
  case "$status:$location" in
    301:"$origin"/* | 308:"$origin"/*) pass "GET $www/ redirects to $location" ;;
    *) fail "GET $www/" "expected a permanent redirect to $origin/, got $status ${location:-(no Location)}" ;;
  esac
fi

# 4. Unknown products: the API knows the catalogue, and an unknown page never carries product content.
request GET "$base/api/reviews/$product_id"
expect_status "GET /api/reviews/<C-Class product>" 200
request GET "$base/api/reviews/prod_smoke_check_unknown"
expect_status "GET /api/reviews/<unknown product>" 404
request GET "$base/smoke-check-unknown-product"
if [ "$status" = 200 ] || [ "$status" = 404 ]; then
  if grep -qF "$product_title" "$tmp/body"; then
    fail "GET /smoke-check-unknown-product" "the response contains product content"
  else
    pass "GET /smoke-check-unknown-product = $status without product content"
  fi
else
  fail "GET /smoke-check-unknown-product" "expected the storefront shell (200) or 404, got $status"
fi

# 5. Checkout validates before talking to Stripe: an invalid payload is a 4xx, never a 5xx or a session.
request POST "$base/api/checkout/session" -H "content-type: application/json" -H "origin: $origin" --data '{"items":[]}'
case "$status" in
  4[0-9][0-9]) pass "POST /api/checkout/session (invalid payload) = $status" ;;
  *) fail "POST /api/checkout/session (invalid payload)" "expected 4xx, got $status $(head -c 200 "$tmp/body")" ;;
esac

# 6. The orders and reviews ledgers (SQLite on the backend's volume) are never served.
for path in /orders.db /reviews.db /data/orders.db /data/reviews.db /api/orders.db /api/data/orders.db /backend/data/orders.db; do
  request GET "$base$path"
  if head -c 16 "$tmp/body" | grep -q 'SQLite format'; then
    fail "GET $path" "served a SQLite database"
  elif grep -qE '(orders|reviews)\.db' "$tmp/body" "$tmp/headers"; then
    fail "GET $path" "the response names a database path"
  else
    pass "GET $path = $status, no database content"
  fi
done
request GET "$base/api/health"
if grep -qE '\.db|/data/' "$tmp/body"; then fail "GET /api/health" "names a database path"; else pass "GET /api/health names no database path"; fi

if [ "$failures" -gt 0 ]; then
  echo "Smoke check FAILED: $failures check(s) failed."
  exit 1
fi
echo "Smoke check passed."
