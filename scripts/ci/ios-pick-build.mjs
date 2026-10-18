import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function pickBuild(finished, running, now = Date.now()) {
  const usable = finished.find(
    (b) => b.artifacts?.buildUrl && (!b.expirationDate || Date.parse(b.expirationDate) > now),
  )
  if (usable) return { kind: 'finished', id: usable.id, url: usable.artifacts.buildUrl }
  if (running[0]) return { kind: 'running', id: running[0].id }
  return { kind: 'none' }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [finishedFile, ...runningFiles] = process.argv.slice(2)
  const read = (f) => JSON.parse(readFileSync(f, 'utf8'))
  console.log(JSON.stringify(pickBuild(read(finishedFile), runningFiles.flatMap(read))))
}
