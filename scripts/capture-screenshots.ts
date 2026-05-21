// One-off Playwright capture for PR/issue visual evidence.
// Lives on the `media` branch only — not part of dev/main.
//
// Usage: with Vite already running on localhost:5173,
//   pnpm exec tsx scripts/capture-screenshots.ts
//
// Captures /learn in signed-out and signed-in states using the auth
// fixture from e2e/.auth/user.json (produced by auth.setup.ts).
// Output: /tmp/oga-screenshots/<name>.png
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = 'http://localhost:5173'
const STATE = 'apps/web/e2e/.auth/user.json'
const OUT = '/tmp/oga-screenshots'

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()

  // Signed-out
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/learn`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${OUT}/learn-signed-out.png` })
    await ctx.close()
  }

  // Signed-in (e2e user — onboarded profile + 15 rounds)
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: STATE,
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/learn`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${OUT}/learn-signed-in.png` })
    await ctx.close()
  }

  await browser.close()
  console.log(`wrote ${OUT}/learn-signed-out.png and learn-signed-in.png`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
