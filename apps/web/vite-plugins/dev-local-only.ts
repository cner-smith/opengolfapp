import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Loopback-only guard for the dev-only `/api/dev*` plugins.
 *
 * WHY THIS EXISTS: Vite runs `configureServer` hooks BEFORE registering its
 * own CORS and host-check middleware, so a route registered inside that hook
 * sits *in front of* `server.allowedHosts` — the defence Vite added
 * specifically against DNS rebinding. Verified against Vite 6.4.2: a request
 * carrying `Host: evil.example.com` got 403 for `/` but reached
 * `/api/dev-admin/stats` and returned the production queue.
 *
 * That matters because both plugins hold a service-role Supabase client with
 * no authentication on any route, and `pnpm dev:admin` points them at
 * production.
 *
 * DO NOT "fix" this by moving the middleware into a returned post-hook so it
 * lands after the host check. `htmlFallbackMiddleware` rewrites GET requests
 * whose Accept header is the wildcard — exactly what `fetch()` sends — to
 * /index.html under spaFallback, so every GET endpoint would silently start
 * returning HTML instead of JSON.
 *
 * Two checks, one per attack:
 *   - Host must be loopback. Defeats DNS rebinding, where the page is served
 *     from `http://attacker.tld:5173` resolving to ::1 (so Host is
 *     attacker.tld while the socket is local).
 *   - Origin, when present, must be loopback. Defeats blind CSRF, where a
 *     foreign page fires a "simple" POST that triggers no preflight. Browsers
 *     always send Origin on cross-origin requests; its absence means a
 *     non-browser client or a same-origin GET.
 *
 * Shared between the two plugins rather than copied. The repo's 3-caller rule
 * would normally keep a two-caller helper inline, but a security control
 * duplicated across two files is precisely what drifts when only one copy gets
 * updated.
 */

// Host headers arrive as `localhost:5173` / `[::1]:5173`; URL.hostname yields
// `[::1]` for an IPv6 literal. Both spellings are listed so neither slips by.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function hostnameOf(hostHeader: string): string {
  // Strip the port without breaking an IPv6 literal's own colons.
  const m = /^(\[[^\]]*\]|[^:]*)(?::\d+)?$/.exec(hostHeader.trim())
  return (m?.[1] ?? '').toLowerCase()
}

/**
 * True when the request must NOT reach a dev-only API route. Sends the 403
 * itself, so callers simply `return` when it returns true.
 */
export function rejectNonLocalRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pluginName: string,
): boolean {
  const host = hostnameOf(req.headers.host ?? '')
  if (!LOOPBACK_HOSTS.has(host)) {
    sendForbidden(res, `[${pluginName}] refused: Host "${host}" is not loopback`)
    return true
  }

  const origin = req.headers.origin
  if (origin) {
    let originHost = ''
    try {
      originHost = new URL(origin).hostname.toLowerCase()
    } catch {
      originHost = ''
    }
    if (!LOOPBACK_HOSTS.has(originHost)) {
      sendForbidden(res, `[${pluginName}] refused: Origin "${origin}" is not loopback`)
      return true
    }
  }

  return false
}

function sendForbidden(res: ServerResponse, message: string): void {
  res.statusCode = 403
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: message }))
}
