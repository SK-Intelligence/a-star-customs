#!/bin/sh
# Waits for the live site to run the expected commits, and explains clearly if it doesn't.
# Run by .github/workflows/deploy-watch.yml after the Quality gate passes on main; runnable by hand:
#
#   sh ops/deploy-watch.sh https://astarcustoms.com <frontend sha> <backend sha>
#
# The frontend redeploys on every commit to main. The backend redeploys only when backend/**
# changes (watch patterns in .railway/railway.ts), so its expected commit is the latest commit on
# main's first-parent line that touched backend/ (the merge commit, which is what Railway
# deploys). Read-only: it only fetches /version.txt and /api/version.
#
# Environment (all optional):
#   DEPLOY_WATCH_TIMEOUT   seconds to wait for both services (default: 900)
#   DEPLOY_WATCH_INTERVAL  seconds between checks (default: 20)
set -u

base=${1:?usage: deploy-watch.sh <site url> <frontend sha> <backend sha>}
base=${base%/}
want_frontend=${2:?frontend sha required}
want_backend=${3:?backend sha required}
timeout=${DEPLOY_WATCH_TIMEOUT:-900}
interval=${DEPLOY_WATCH_INTERVAL:-20}
railway_url="https://railway.com/project/ab0adfb4-474d-4bdd-a088-0bcec7faab62"

short() { printf '%.7s' "$1"; }

# Only a full commit hash counts; anything else (an old build's index.html fallback, "unknown",
# an error page) is reported as no commit.
commit_or_empty() { grep -xE '[0-9a-f]{40}' || true; }

live_frontend() {
  curl -fsS --max-time 15 -H 'Cache-Control: no-cache' "$base/version.txt" 2>/dev/null | tr -d ' \r' | head -n 1 | commit_or_empty
}

live_backend() {
  curl -fsS --max-time 15 "$base/api/version" 2>/dev/null |
    sed -n 's/.*"commit"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | commit_or_empty
}

# A push of several commits redeploys the backend at the push's last commit, not the last one that
# touched backend/, so any first-parent commit from $want_backend up to HEAD counts (needs the
# full git history, as the workflow checks it out).
backend_matches() {
  [ -n "$1" ] || return 1
  [ "$1" = "$want_backend" ] && return 0
  git cat-file -e "$1^{commit}" 2>/dev/null || return 1
  git rev-list --first-parent "$want_backend~1..HEAD" 2>/dev/null | grep -qx "$1"
}

echo "Waiting up to ${timeout}s for $base to serve frontend $(short "$want_frontend") and backend $(short "$want_backend")"

deadline=$(($(date +%s) + timeout))
frontend_ok=0
backend_ok=0
while :; do
  got_frontend=$(live_frontend)
  got_backend=$(live_backend)
  [ "$got_frontend" = "$want_frontend" ] && frontend_ok=1
  backend_matches "$got_backend" && backend_ok=1
  echo "  frontend: $(short "${got_frontend:-none}")  backend: $(short "${got_backend:-none}")"
  if [ "$frontend_ok" = 1 ] && [ "$backend_ok" = 1 ]; then
    echo "Live: both services are running the expected commits."
    exit 0
  fi
  [ "$(date +%s)" -ge "$deadline" ] && break
  sleep "$interval"
done

# One annotation per stuck service, worded for whoever merged the change.
explain() {
  service=$1 want=$2 got=$3
  if [ -z "$got" ]; then
    detail="it does not report a commit (it may be down or failing its health check, or this is its first deploy with version reporting)."
  else
    detail="it is still running $(short "$got")."
  fi
  echo "::error title=$service not updated::The $service should be running $(short "$want") but $detail Most likely cause: Railway is holding the deploy with status NEEDS APPROVAL, which happens when the commit author's GitHub account is not a member of the Railway project. Fix: open $railway_url, select the $service service, open Deployments and click Approve on the newest one (or ask a project member to). If it shows FAILED instead, open its build logs."
}

[ "$frontend_ok" = 1 ] || explain frontend "$want_frontend" "$got_frontend"
[ "$backend_ok" = 1 ] || explain backend "$want_backend" "$got_backend"
exit 1
