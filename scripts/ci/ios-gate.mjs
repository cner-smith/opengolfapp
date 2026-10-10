import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const RELEASE_PLEASE_HEAD = 'release-please--branches--main--components--oga'
const LABEL = 'ios-check'

export function gate({ event, action, label, base, head, headRepo, repo, labels = [] }) {
  if (event === 'workflow_dispatch') return { run: true }
  if (action === 'labeled' && label !== LABEL) return { run: false }
  const wanted =
    (base === 'main' && head !== RELEASE_PLEASE_HEAD) || labels.includes(LABEL)
  if (!wanted) return { run: false }
  if (headRepo !== repo) {
    return { run: false, error: 'iOS check does not run on fork PRs (no secrets). A maintainer can push the branch to this repo.' }
  }
  return { run: true }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const e = process.env
  const r = gate({
    event: e.EVENT, action: e.ACTION, label: e.LABEL, base: e.BASE, head: e.HEAD,
    headRepo: e.HEAD_REPO, repo: e.REPO, labels: JSON.parse(e.LABELS || '[]'),
  })
  appendFileSync(e.GITHUB_OUTPUT, `run=${r.run}\n`)
  if (r.error) {
    console.error(`::error::${r.error}`)
    process.exit(1)
  }
}
