#!/bin/bash
# Publishes notes marked `intranet: true` in the almirah vault to the Casegoods intranet.
#   ./sync.sh            rebuild content/, commit and push
#   ./sync.sh --preview  rebuild content/ only, nothing leaves this machine
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" = "--preview" ]; then
    node scripts/build-content.mjs
    echo "Preview only. Nothing was committed or pushed."
    exit 0
fi

echo "Pulling latest changes..."
git pull --rebase --autostash
node scripts/build-content.mjs
git add -A
if git diff --cached --quiet; then
    echo "No changes to sync."
    exit 0
fi
git commit -m "casenotes sync: $(date '+%Y-%m-%d %H:%M')"
echo "Pushing to GitHub..."
git push
echo "Done! Site will update in 2-3 minutes."
