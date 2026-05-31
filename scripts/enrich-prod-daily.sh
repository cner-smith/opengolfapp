#!/usr/bin/env bash
#
# Daily OpenGolfAPI enrichment pass, bounded to stay under the API's
# ~900 requests/day soft cap. Resumable: the crawler skips already-teed
# courses and states already marked `done` in crawl_state, so each run
# continues where the last left off until every state is enriched.
#
# Intended for a local crontab. One-time setup:
#
#   1. Create <repo>/.env.crawl.prod.local (gitignored via the .env.*.local
#      pattern) with the PROD project's credentials:
#        SUPABASE_URL=https://<prod-ref>.supabase.co
#        SUPABASE_SERVICE_ROLE_KEY=<prod service-role key>
#
#   2. Add a crontab entry (run `crontab -e`) — e.g. 3:15am daily:
#        15 3 * * * /ABSOLUTE/PATH/TO/scripts/enrich-prod-daily.sh
#
# Watch progress any time with:
#   tail -f /tmp/oga-enrich-prod.log
#   npx tsx scripts/crawl-courses.ts --status   # (with the same env loaded)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

ENV_FILE="$REPO/.env.crawl.prod.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing $ENV_FILE (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for prod)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

LOG="/tmp/oga-enrich-prod.log"
STAMP="$(date +%Y-%m-%d\ %H:%M:%S)"
{
  echo "=== enrich run $STAMP (budget 400 courses) ==="
  # 400 courses * up to ~2 calls each stays comfortably under the ~900/day cap.
  npx tsx scripts/crawl-courses.ts --source enrich --max-courses 400
  echo "=== finished $STAMP ==="
} >> "$LOG" 2>&1
