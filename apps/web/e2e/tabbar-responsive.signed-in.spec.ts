import { test, expect } from '@playwright/test'

// Regression guard for the #815 inline-style override: the bar carried
// `md:hidden` in its class list AND `display:'flex'` inline, and an inline
// display beats a stylesheet media query, so it rendered at every width —
// on desktop, alongside the sidebar.
//
// Asserts computed `display` rather than Playwright's visibility heuristic:
// the heuristic reported this bar as hidden at 1440px even while it was
// painting 1440x58 on screen, so it cannot tell the two versions apart.
async function tabBarDisplay(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/learn')
  await page.waitForSelector('nav[aria-label="Primary"]', { state: 'attached' })
  return page.evaluate(() => {
    const el = document.querySelector('nav[aria-label="Primary"]')
    if (!el) return { display: '(absent)', width: 0 }
    return {
      display: getComputedStyle(el).display,
      width: Math.round(el.getBoundingClientRect().width),
    }
  })
}

test.describe('MobileTabBar responsive gate', () => {
  test('display:none on desktop widths', async ({ page }) => {
    const r = await tabBarDisplay(page, 1440)
    expect(r.display).toBe('none')
    expect(r.width).toBe(0)
  })

  test('display:none at the md breakpoint itself (768px)', async ({ page }) => {
    expect((await tabBarDisplay(page, 768)).display).toBe('none')
  })

  test('display:flex on mobile widths', async ({ page }) => {
    const r = await tabBarDisplay(page, 390)
    expect(r.display).toBe('flex')
    expect(r.width).toBeGreaterThan(300)
  })
})
