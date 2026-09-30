#!/usr/bin/env node
/**
 * Screenshots the HeroBanner harness four ways: light/dark x desktop/mobile.
 *
 * 🔴 WHY A HARNESS AND NOT THE APP. The hero only renders for a signed-in member
 * with slices, and useAuth hardcodes the login redirect to production, so the banner
 * cannot be reached on localhost by clicking (see CLAUDE.md). /banner-harness.html
 * mounts HeroBanner directly with real bannerFor() output, so the design check runs
 * with no credentials. It does NOT exercise AppShell's photoUrl/credit precedence —
 * that needs the cs_token paste.
 *
 * Cropping depends only on the box's ASPECT RATIO, never its pixel size, so the
 * harness's narrower column crops identically to the real feed column.
 *
 *   npm run dev                     # note the port it prints
 *   node scripts/shoot-banners.mjs [--port 5173] [--out DIR]
 *
 * Requires Playwright (`npm i -D playwright`, or a global install). Not a dependency
 * of this repo — it is a local verification tool, not part of the build.
 */
import { mkdirSync } from 'node:fs'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = arg('--port', '5173')
const OUT = arg('--out', 'banner-shots')
const URL = `http://localhost:${PORT}/banner-harness.html`

/**
 * Playwright is not a dependency of this repo, so resolve it from wherever it lives:
 * a local devDependency first, then a global install. ESM ignores NODE_PATH and will
 * not find a global package on its own, hence the explicit `npm root -g` fallback.
 */
async function loadChromium() {
  for (const spec of ['playwright', await globalSpec()]) {
    if (!spec) continue
    try {
      const mod = await import(spec)
      const c = mod.chromium ?? mod.default?.chromium
      if (c) return c
    } catch { /* try the next location */ }
  }
  return null
}

async function globalSpec() {
  try {
    const { execFileSync } = await import('node:child_process')
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).trim()
    if (!root) return null
    const { pathToFileURL } = await import('node:url')
    const { join } = await import('node:path')
    return pathToFileURL(join(root, 'playwright', 'index.js')).href
  } catch {
    return null
  }
}

const chromium = await loadChromium()
if (!chromium) {
  console.error('Playwright not found locally or globally. Install it with:')
  console.error('  npm i -D playwright   (or:  npm i -g playwright)')
  console.error('then:  npx playwright install chromium')
  process.exit(1)
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'mobile', width: 390, height: 1200 },
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
let problems = 0

for (const theme of ['light', 'dark']) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    const failed = []
    page.on('requestfailed', (r) => failed.push(r.url()))

    // index.html reads this before first paint; the class toggle below covers the
    // harness page, which has no such inline script.
    await page.addInitScript((t) => localStorage.setItem('ev:color-scheme', t), theme)
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)

    // Every banner must be decoded before the shot, then the 700ms fade must finish,
    // or a screenshot catches opacity:0 and looks like a missing image.
    const imgs = await page.evaluate(async () => {
      const els = [...document.querySelectorAll('img')]
      await Promise.all(els.map((i) => (i.complete ? null : i.decode().catch(() => null))))
      return els.map((i) => ({ src: i.src.split('/').pop(), ok: i.naturalWidth > 0 }))
    })
    await page.waitForTimeout(1200)

    await page.screenshot({ path: `${OUT}/${theme}-${vp.name}.png`, fullPage: true })

    const broken = imgs.filter((i) => !i.ok)
    problems += broken.length + failed.length + errors.length
    console.log(
      `${theme}/${vp.name}: ${imgs.length} imgs, ${broken.length} broken` +
        `${failed.length ? `, ${failed.length} req failed` : ''}` +
        `${errors.length ? `, ERRORS: ${errors.join(' | ')}` : ''}`
    )
    if (broken.length) console.log('  broken:', broken.map((i) => i.src).join(', '))
    await ctx.close()
  }
}
await browser.close()

console.log(`\nWrote 4 screenshots to ${OUT}/. NOW LOOK AT THEM — a clean run only proves`)
console.log('the images decoded, not that the layout, contrast or credit placement is right.')
process.exit(problems > 0 ? 1 : 0)
