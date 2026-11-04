#!/bin/sh
# Installs the LaunchAgent that triggers the paper sync every Monday 06:00.
# launchd replays a calendar job after sleep but not after power-off, so it
# also runs at login; the server's 5-per-6-days budget makes repeats harmless.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)
NODE=$(command -v node)
PLIST="$HOME/Library/LaunchAgents/lab.aret.bbip-papers.plist"
mkdir -p "$HOME/Library/Logs/bbip"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>lab.aret.bbip-papers</string>
	<key>ProgramArguments</key>
	<array>
		<string>$NODE</string>
		<string>$ROOT/scripts/run-papers-sync.mjs</string>
	</array>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Weekday</key>
		<integer>1</integer>
		<key>Hour</key>
		<integer>6</integer>
		<key>Minute</key>
		<integer>0</integer>
	</dict>
	<key>RunAtLoad</key>
	<true/>
	<key>StandardOutPath</key>
	<string>$HOME/Library/Logs/bbip/papers.log</string>
	<key>StandardErrorPath</key>
	<string>$HOME/Library/Logs/bbip/papers.log</string>
	<key>WorkingDirectory</key>
	<string>$ROOT</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/lab.aret.bbip-papers" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed lab.aret.bbip-papers (Mondays 06:00 and at login)"
