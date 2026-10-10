import test from 'node:test'
import assert from 'node:assert/strict'
import { pickBuild } from './ios-pick-build.mjs'

const NOW = Date.parse('2026-10-10T00:00:00Z')
const done = (id, exp, url = `https://expo.dev/artifacts/${id}.tar.gz`) => ({
  id, expirationDate: exp, artifacts: url ? { buildUrl: url } : {},
})

test('picks the newest unexpired finished build', () => {
  const r = pickBuild([done('a', '2026-12-01T00:00:00Z'), done('b', '2026-11-01T00:00:00Z')], [], NOW)
  assert.deepEqual(r, { kind: 'finished', id: 'a', url: 'https://expo.dev/artifacts/a.tar.gz' })
})
test('skips an expired build and falls to the next', () => {
  const r = pickBuild([done('a', '2026-09-01T00:00:00Z'), done('b', '2026-11-01T00:00:00Z')], [], NOW)
  assert.equal(r.id, 'b')
})
test('skips a finished build with no artifact url', () => {
  assert.deepEqual(pickBuild([done('a', '2026-12-01T00:00:00Z', null)], [], NOW), { kind: 'none' })
})
test('uses a running build only when nothing finished is usable', () => {
  assert.deepEqual(pickBuild([done('a', '2026-09-01T00:00:00Z')], [{ id: 'r' }], NOW), { kind: 'running', id: 'r' })
})
test('prefers finished over running', () => {
  assert.equal(pickBuild([done('a', '2026-12-01T00:00:00Z')], [{ id: 'r' }], NOW).kind, 'finished')
})
test('nothing at all', () => assert.deepEqual(pickBuild([], [], NOW), { kind: 'none' }))
