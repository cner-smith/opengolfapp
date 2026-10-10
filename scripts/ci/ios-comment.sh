#!/usr/bin/env bash
# Create or update the single iOS-check PR comment. Usage: ios-comment.sh <markdown file>
# Env: GH_TOKEN  GITHUB_REPOSITORY  PR. The file must contain the marker <!-- ios-check -->.
set -euo pipefail
body=$1
id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
  --jq '.[] | select(.user.login == "github-actions[bot]" and (.body | contains("<!-- ios-check -->"))) | .id' | sed -n 1p)
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -F body=@"$body" > /dev/null
else
  gh api -X POST "repos/$GITHUB_REPOSITORY/issues/$PR/comments" -F body=@"$body" > /dev/null
fi
