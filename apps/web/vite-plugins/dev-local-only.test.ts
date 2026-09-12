import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectNonLocalRequest } from './dev-local-only'

// These routes hold a service-role client with no auth and, under
// `pnpm dev:admin`, point at production — so the host/origin parsing here is
// the only thing between a malicious page and that client. It is a parser on a
// security path, which is why it gets a test even though the plugins around it
// do not.

function fakeReq(headers: Record<string, string | undefined>): IncomingMessage {
  return { headers } as unknown as IncomingMessage
}

function fakeRes(): ServerResponse & { statusCode: number; body: string } {
  const res = {
    statusCode: 200,
    body: '',
    setHeader() {},
    end(chunk?: string) {
      if (chunk) res.body = chunk
    },
  }
  return res as unknown as ServerResponse & { statusCode: number; body: string }
}

function rejected(headers: Record<string, string | undefined>): boolean {
  return rejectNonLocalRequest(fakeReq(headers), fakeRes(), 'test')
}

describe('rejectNonLocalRequest', () => {
  it('allows every loopback spelling, with and without a port', () => {
    for (const host of [
      'localhost',
      'localhost:5173',
      '127.0.0.1',
      '127.0.0.1:5173',
      '[::1]',
      '[::1]:5173',
      'LOCALHOST:5173',
    ]) {
      expect(rejected({ host }), host).toBe(false)
    }
  })

  it('rejects a foreign Host — the DNS-rebinding case', () => {
    expect(rejected({ host: 'evil.example.com' })).toBe(true)
    expect(rejected({ host: 'evil.example.com:5173' })).toBe(true)
  })

  it('rejects hosts that merely contain a loopback name', () => {
    // A substring check instead of exact matching would let all of these
    // through, and an attacker controls their own DNS names.
    for (const host of [
      'localhost.evil.com',
      'evil.com.localhost.evil.com',
      'notlocalhost',
      '127.0.0.1.evil.com',
      'my-localhost:5173',
    ]) {
      expect(rejected({ host }), host).toBe(true)
    }
  })

  it('rejects a missing or empty Host', () => {
    expect(rejected({})).toBe(true)
    expect(rejected({ host: '' })).toBe(true)
  })

  it('allows a same-origin request and one with no Origin at all', () => {
    // No Origin means a non-browser client or a same-origin GET.
    expect(rejected({ host: 'localhost:5173' })).toBe(false)
    expect(rejected({ host: 'localhost:5173', origin: 'http://localhost:5173' })).toBe(false)
    expect(rejected({ host: '[::1]:5173', origin: 'http://[::1]:5173' })).toBe(false)
  })

  it('rejects a foreign Origin even when Host is loopback — the CSRF case', () => {
    // This is the shape that needs no preflight: a "simple" POST from a page
    // the maintainer happens to have open.
    expect(rejected({ host: 'localhost:5173', origin: 'https://evil.example.com' })).toBe(true)
    expect(rejected({ host: 'localhost:5173', origin: 'http://localhost.evil.com' })).toBe(true)
  })

  it('rejects an unparseable Origin rather than ignoring it', () => {
    expect(rejected({ host: 'localhost:5173', origin: 'not-a-url' })).toBe(true)
  })

  it('reports why it refused, so a real failure is diagnosable', () => {
    const res = fakeRes()
    const blocked = rejectNonLocalRequest(
      fakeReq({ host: 'evil.example.com' }),
      res,
      'dev-admin-api',
    )
    expect(blocked).toBe(true)
    expect(res.statusCode).toBe(403)
    expect(res.body).toContain('dev-admin-api')
    expect(res.body).toContain('evil.example.com')
  })
})
