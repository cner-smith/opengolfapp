import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { addTsExt } from './vendor-transform.mjs'
const SRC = 'packages/core/src/practice-plan'
const VEN = 'supabase/functions/_shared/practice-plan'
const files = readdirSync(SRC).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts')
let drift = false
for (const f of files) {
  const a = addTsExt(readFileSync(join(SRC, f), 'utf8'))
  let b
  try { b = readFileSync(join(VEN, f), 'utf8') } catch { b = null }
  if (b !== a) { drift = true; console.error(`DRIFT: ${VEN}/${f} != ${SRC}/${f}${b == null ? ' (missing)' : ''}`) }
}
let venFiles = []
try { venFiles = readdirSync(VEN).filter((f) => f.endsWith('.ts') && f !== 'index.ts') } catch { /* VEN dir not created yet */ }
for (const f of venFiles) {
  if (!files.includes(f)) { drift = true; console.error(`ORPHAN: ${VEN}/${f} has no source in ${SRC}`) }
}
if (drift) { console.error('\nVendored _shared/practice-plan copies are out of sync. Re-run: node scripts/vendor-practice-plan.mjs'); process.exit(1) }
console.log(`vendor check OK (${files.length} files)`)
