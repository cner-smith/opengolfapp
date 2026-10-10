#!/usr/bin/env bash
# Push the run's PNGs to the media branch and write a markdown image list to $OUT_MD.
# Env: SHOTS_DIR  DEST (screenshots/ci-ios/pr-12/ab12cd3)  GH_TOKEN  GITHUB_REPOSITORY  OUT_MD
set -euo pipefail
: "${SHOTS_DIR:?}" "${DEST:?}" "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}" "${OUT_MD:?}"
shopt -s nullglob
pngs=("$SHOTS_DIR"/*.png)
if [ ${#pngs[@]} -eq 0 ]; then
  echo "no screenshots to publish" >&2
  : > "$OUT_MD"
  exit 0
fi

work=$(mktemp -d)
git clone --quiet --depth 1 --branch media \
  "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "$work"
cd "$work"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

mkdir -p "$DEST"
cp "${pngs[@]}" "$DEST/"

# Keep only the 3 newest SHA directories for this PR (the new one has no commit yet: treat it as newest).
parent=$(dirname "$DEST")
for d in "$parent"/*/; do
  d=${d%/}
  echo "$(git log -1 --format=%ct -- "$d" | sed 's/^$/9999999999/') $d"
done | sort -rn | tail -n +4 | cut -d' ' -f2- | while IFS= read -r old; do rm -rf "$old"; done

git add -A
git commit --quiet -m "ci-ios: screenshots for $DEST"
ok=0
for i in 1 2 3 4; do
  if git push --quiet origin media; then ok=1; break; fi
  git pull --rebase --quiet origin media
  sleep $((i * 3))
done
[ "$ok" = 1 ] || { echo "media push failed" >&2; exit 1; }

base="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/media/${DEST}"
: > "$OUT_MD"
for f in "${pngs[@]}"; do
  n=$(basename "$f")
  printf '<img width="220" alt="%s" src="%s/%s">\n' "${n%.png}" "$base" "$n" >> "$OUT_MD"
done
