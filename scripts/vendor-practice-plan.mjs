import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { addTsExt } from './vendor-transform.mjs'

const SRC = 'packages/core/src/practice-plan'
const VEN = 'supabase/functions/_shared/practice-plan'

// Read source files (exclude test files and index.ts — barrel is hand-maintained)
const { readdirSync } = await import('node:fs')
const files = readdirSync(SRC).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts',
)

mkdirSync(VEN, { recursive: true })

for (const f of files) {
  const src = readFileSync(join(SRC, f), 'utf8')
  const transformed = addTsExt(src)
  writeFileSync(join(VEN, f), transformed, 'utf8')
  console.log(`vendored: ${f}`)
}

console.log(`\nvendor-practice-plan: wrote ${files.length} files to ${VEN}`)
