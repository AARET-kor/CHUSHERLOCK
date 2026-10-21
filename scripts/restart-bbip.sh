#!/bin/sh
# Rebuild and restart the always-on local BBIP server on :3200.
# The server runs as the LaunchAgent lab.aret.bbip
# (~/Library/LaunchAgents/lab.aret.bbip.plist): it starts at login and
# launchd restarts it if it exits. Logs: ~/Library/Logs/bbip/.
set -e
cd "$(dirname "$0")/.."
npm run build
launchctl kickstart -k "gui/$(id -u)/lab.aret.bbip"
echo "BBIP restarted on http://localhost:3200"
