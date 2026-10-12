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
"$adb" get-state >/dev/null 2>&1 || { echo "No emulator/device attached" >&2; exit 1; }
curl -sf localhost:8081/status >/dev/null || { echo "Metro isn't running on :8081" >&2; exit 1; }
"$adb" reverse tcp:8081 tcp:8081 >/dev/null

# Read values literally: the password can contain `$`, so the file is never sourced.
val() { grep -m1 "^$1=" "$env_file" | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
# The seed wipes the account's rounds: never against production.
if grep -q 'znjmkptblswxststjxwc' <(val SUPABASE_URL); then echo "Env file points at production; refusing" >&2; exit 1; fi

# Fresh e2e account each run (wipe + reseed on DEV), so flows are repeatable.
(cd "$root" && DOTENV_CONFIG_PATH="$env_file" npx tsx scripts/seed-demo.ts >/dev/null)

flows=("$@")
[ ${#flows[@]} -gt 0 ] || flows=("$here")
maestro test -e E2E_EMAIL="$(val E2E_EMAIL)" -e E2E_PASSWORD="$(val E2E_PASSWORD)" "${flows[@]}"
