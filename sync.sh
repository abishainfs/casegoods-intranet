#!/bin/bash
echo "Syncing Obsidian vault..."
cp -r /Users/casegoods01/Documents/almirah/Casegoods/* content/
echo "Pushing to GitHub..."
git add -A
git commit -m "vault sync: $(date '+%Y-%m-%d %H:%M')"
git push
echo "Done! Site will update in 2-3 minutes."