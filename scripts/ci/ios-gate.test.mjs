import test from 'node:test'
import assert from 'node:assert/strict'
import { gate } from './ios-gate.mjs'

const REPO = 'cner-smith/opengolfapp'
const pr = (o) => ({ event: 'pull_request', action: 'synchronize', base: 'main', head: 'feature/x', headRepo: REPO, repo: REPO, labels: [], ...o })

test('feature PR into main runs', () => assert.equal(gate(pr({})).run, true))
test('release-please PR into main is skipped', () =>
  assert.equal(gate(pr({ head: 'release-please--branches--main--components--oga' })).run, false))
test('dev PR without the label is skipped', () => assert.equal(gate(pr({ base: 'dev' })).run, false))
test('dev PR with the label runs on push', () =>
  assert.equal(gate(pr({ base: 'dev', labels: ['ios-check'] })).run, true))
test('adding ios-check to a dev PR runs', () =>
  assert.equal(gate(pr({ base: 'dev', action: 'labeled', label: 'ios-check', labels: ['ios-check'] })).run, true))
test('adding another label to a main PR does not rerun', () =>
  assert.equal(gate(pr({ action: 'labeled', label: 'bug', labels: ['bug'] })).run, false))
test('manual dispatch runs', () => assert.equal(gate({ event: 'workflow_dispatch' }).run, true))
test('fork PR that would run errors loudly', () => {
  const r = gate(pr({ headRepo: 'someone/fork' }))
  assert.equal(r.run, false)
  assert.match(r.error, /fork/i)
})
test('fork PR that would not run stays quiet', () => {
  const r = gate(pr({ base: 'dev', headRepo: 'someone/fork' }))
  assert.equal(r.run, false)
  assert.equal(r.error, undefined)
})
