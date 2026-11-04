#!/bin/sh
# Asks the running BBIP server for the weekly paper sync. The token is read
# from .env.local and passed on stdin, so it never appears in `ps` or the plist.
# Waits for the server when launchd fires this right after login.
set -e
cd "$(dirname "$0")/.."
TOKEN=$(sed -n 's/^CODEX_ACCESS_TOKEN=//p' .env.local | tr -d '"'"'"'')
printf 'user = "bbip:%s"\n' "$TOKEN" | curl --silent --show-error --config - \
  --retry 10 --retry-connrefused --retry-delay 30 \
  --request POST --header 'Content-Type: application/json' \
  --data '{"kind":"weekly"}' \
  --write-out '\n%{http_code}\n' \
  http://localhost:3200/api/papers/sync
