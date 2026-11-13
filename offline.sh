#!/bin/bash
# Kill switch for casenotes.
#   ./offline.sh on      take the site down: visitors see the "workshop is closed" page
#   ./offline.sh off     bring the site back
#   ./offline.sh status  say which it is
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-status}" in
  on)
    [ -f OFFLINE ] && { echo "Already offline."; exit 0; }
    echo "Taken offline $(date '+%Y-%m-%d %H:%M')" > OFFLINE
    git add OFFLINE && git commit -q -m "casenotes: offline" && git push -q
    echo "Going offline. The closed page will show in 2-3 minutes." ;;
  off)
    [ -f OFFLINE ] || { echo "Already online."; exit 0; }
    git rm -q OFFLINE && git commit -q -m "casenotes: back online" && git push -q
    echo "Coming back online in 2-3 minutes." ;;
  status)
    [ -f OFFLINE ] && echo "Offline ($(cat OFFLINE))." || echo "Online." ;;
  *) echo "Usage: ./offline.sh on|off|status"; exit 1 ;;
esac
