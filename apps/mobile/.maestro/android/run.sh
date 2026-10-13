#!/usr/bin/env bash
# Runs the Android live-round flows on a local emulator against the DEV backend.
# Needs: a running emulator with the dev client installed, Metro on :8081, Maestro, and an env
# file with E2E_EMAIL / E2E_PASSWORD and the seed variables (default apps/web/.env.test.local).
# Usage: apps/mobile/.maestro/android/run.sh [flow.yaml ...]   (default: every flow here)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(git -C "$here" rev-parse --show-toplevel)"
env_file="${E2E_ENV_FILE:-$root/apps/web/.env.test.local}"
adb="${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb"

[ -f "$env_file" ] || { echo "No env file at $env_file (set E2E_ENV_FILE)" >&2; exit 1; }
[ "$("$adb" devices | grep -cw device)" -eq 1 ] || { echo "Attach exactly one emulator/device" >&2; exit 1; }
curl -sf localhost:8081/status >/dev/null || { echo "Metro isn't running on :8081" >&2; exit 1; }
"$adb" reverse tcp:8081 tcp:8081 >/dev/null

# Read values literally: the password can contain `$`, so the file is never sourced.
val() { grep -m1 "^$1=" "$env_file" | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
for k in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY E2E_EMAIL E2E_PASSWORD; do
  [ -n "$(val "$k")" ] || { echo "$k missing from $env_file" >&2; exit 1; }
done
# The seed resets SEED_EMAIL; the flows sign in as E2E_EMAIL. They must be one account.
[ "$(val SEED_EMAIL)" = "$(val E2E_EMAIL)" ] || { echo "SEED_EMAIL and E2E_EMAIL differ in $env_file" >&2; exit 1; }
# The seed wipes the account's rounds: never against production.
case "$(val SUPABASE_URL)" in *znjmkptblswxststjxwc*) echo "Env file points at production; refusing" >&2; exit 1 ;; esac

# Fresh e2e account each run (wipe + reseed on DEV), so flows are repeatable.
# dotenv never overrides the shell, so drop any exported copies: the file checked above is what runs.
(cd "$root" && env -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u SEED_EMAIL -u SEED_PASSWORD -u SEED_USERNAME \
  DOTENV_CONFIG_PATH="$env_file" npx tsx scripts/seed-demo.ts >/dev/null)

# GPS bridge: flows move the emulator's own GPS (subflows/gps.yaml) by calling this local server,
# which runs `adb emu geo fix`. Only numbers are accepted, so the request can't inject a command.
port="${GPS_BRIDGE_PORT:-8099}"
ADB="$adb" python3 - "$port" <<'PY' &
import http.server, os, subprocess, sys, urllib.parse
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        try:
            lat, lng = float(q['lat'][0]), float(q['lng'][0])
        except (KeyError, ValueError):
            self.send_response(400); self.end_headers(); return
        ok = subprocess.run([os.environ['ADB'], 'emu', 'geo', 'fix', str(lng), str(lat)], capture_output=True).returncode == 0
        self.send_response(200 if ok else 500); self.end_headers()
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY
bridge=$!
trap 'kill $bridge 2>/dev/null' EXIT
# Wait until the bridge answers (400 = up, no coordinates); fail if it died (port taken).
for _ in $(seq 1 50); do
  kill -0 "$bridge" 2>/dev/null || { echo "GPS bridge failed to start on :$port" >&2; exit 1; }
  [ "$(curl -s -o /dev/null -w '%{http_code}' "127.0.0.1:$port/geo")" = 400 ] && break
  sleep 0.1
done

flows=("$@")
[ ${#flows[@]} -gt 0 ] || flows=("$here")
maestro test -e E2E_EMAIL="$(val E2E_EMAIL)" -e E2E_PASSWORD="$(val E2E_PASSWORD)" -e GPS_BRIDGE_PORT="$port" "${flows[@]}"
