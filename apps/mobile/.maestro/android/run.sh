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
# /net?mode=stall|slow|off (subflows/net.yaml) points the device's proxy at a port here: `stall`
# accepts connections and never answers (weak signal); `slow` tunnels them but holds each chunk the
# app sends for 2 s, so every request takes seconds (opens race windows the flows need). Toggling
# airplane mode drops the app's open connections, which would otherwise keep going direct.
port="${GPS_BRIDGE_PORT:-8099}"
ADB="$adb" python3 - "$port" <<'PY' &
import http.server, os, socket, subprocess, sys, threading, time, urllib.parse
def listen(handler):
    srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('127.0.0.1', 0)); srv.listen(64)
    def loop():
        while True:
            c = srv.accept()[0]
            threading.Thread(target=handler, args=(c,), daemon=True).start()
    threading.Thread(target=loop, daemon=True).start()
    return srv.getsockname()[1]
held = []
def stall(c):
    held.append(c)  # never answer
def pump(a, b, delay):
    try:
        while True:
            d = a.recv(65536)
            if not d: break
            if delay: time.sleep(delay)
            b.sendall(d)
    except OSError: pass
    finally:
        a.close(); b.close()
def slow(c):
    req = b''
    while b'\r\n\r\n' not in req:
        d = c.recv(4096)
        if not d: c.close(); return
        req += d
    if not req.startswith(b'CONNECT '):
        c.close(); return  # plain HTTP is Metro's dev traffic, not the app's API
    host, p = req.split(b' ')[1].decode().rsplit(':', 1)
    try:
        s = socket.create_connection((host, int(p)), timeout=30)
    except OSError:
        c.close(); return
    s.settimeout(None)
    c.sendall(b'HTTP/1.1 200 Connection established\r\n\r\n')
    threading.Thread(target=pump, args=(c, s, 2), daemon=True).start()
    pump(s, c, 0)
PROXY = {'stall': listen(stall), 'slow': listen(slow)}
def adb(*a):
    return subprocess.run([os.environ['ADB'], 'shell', *a], capture_output=True).returncode == 0
def set_mode(mode):
    ok = adb('settings', 'put', 'global', 'http_proxy', '10.0.2.2:%d' % PROXY[mode] if mode in PROXY else ':0')
    ok = adb('cmd', 'connectivity', 'airplane-mode', 'enable') and ok
    time.sleep(1)
    ok = adb('cmd', 'connectivity', 'airplane-mode', 'disable') and ok
    time.sleep(5)  # wifi reconnects; Maestro's http.get gives up at 10 s
    return ok
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/net':
            mode = q.get('mode', [''])[0]
            if mode not in ('stall', 'slow', 'off'):
                self.send_response(400); self.end_headers(); return
            self.send_response(200 if set_mode(mode) else 500); self.end_headers(); return
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
# A flow that fails mid-stall must not leave the device behind a dead proxy.
trap 'kill $bridge 2>/dev/null; "$adb" shell settings put global http_proxy :0 >/dev/null 2>&1; "$adb" shell cmd connectivity airplane-mode disable >/dev/null 2>&1' EXIT
# Wait until the bridge answers (400 = up, no coordinates); fail if it died (port taken).
for _ in $(seq 1 50); do
  kill -0 "$bridge" 2>/dev/null || { echo "GPS bridge failed to start on :$port" >&2; exit 1; }
  [ "$(curl -s -o /dev/null -w '%{http_code}' "127.0.0.1:$port/geo")" = 400 ] && break
  sleep 0.1
done

flows=("$@")
[ ${#flows[@]} -gt 0 ] || flows=("$here")
maestro test -e E2E_EMAIL="$(val E2E_EMAIL)" -e E2E_PASSWORD="$(val E2E_PASSWORD)" -e GPS_BRIDGE_PORT="$port" "${flows[@]}"
