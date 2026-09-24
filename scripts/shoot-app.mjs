#!/usr/bin/env node
/**
 * Signed-in visual check of the REAL app — the pass scripts/shoot-banners.mjs cannot do.
 *
 * The harness mounts HeroBanner in isolation. This drives AppShell itself, so it is the
 * only thing that exercises the photoUrl/credit precedence (a DB photo_url overrides the
 * shared library and carries no credit), useJurisdictionName, and the banner sitting in
 * the real feed column beside the sidebar.
 *
 * 🔴 NEEDS A SESSION TOKEN, AND IT IS A REAL CREDENTIAL.
 * You cannot log in on localhost — useAuth hardcodes the redirect to production. So:
 *   1. Sign in at https://civicspaces.empowered.vote
 *   2. DevTools > Application > Local Storage > copy the `cs_token` value
 *   3. Paste it alone into `.auth-token.local` at the repo root (gitignored)
 *
 * The token is read from disk and put straight into the browser's localStorage. It is
 * never printed, never logged, and never written to a screenshot path. Delete the file
 * when you are done. Tokens expire — this refuses to run on an expired one rather than
 * leaving you to debug an empty feed.
 *
 *   npm run dev
 *   node scripts/shoot-app.mjs [--port 5173] [--out app-shots]
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = arg('--port', '5173')
const OUT = arg('--out', 'app-shots')
const TOKEN_FILE = arg('--token-file', '.auth-token.local')
const ORIGIN = `http://localhost:${PORT}`

if (!existsSync(TOKEN_FILE)) {
  console.error(`No ${TOKEN_FILE}. See the header of this file for how to get one.`)
  process.exit(1)
}
const token = readFileSync(TOKEN_FILE, 'utf8').trim()
if (!token) {
  console.error(`${TOKEN_FILE} is empty.`)
  process.exit(1)
}

// Decode locally so an expired token fails loudly here, not as a blank feed later.
// Mirrors decodeUserId in src/hooks/useAuth.ts: external_id first, then sub.
function payload(t) {
  try {
    const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='), 'base64').toString())
  } catch {
    return null
  }
}
const claims = payload(token)
if (!claims) {
  console.error('Token is not a readable JWT (expected three dot-separated parts).')
  process.exit(1)
}
const now = Math.floor(Date.now() / 1000)
if (typeof claims.exp !== 'number' || claims.exp <= now) {
  console.error(`Token expired ${claims.exp ? `${Math.round((now - claims.exp) / 60)} min ago` : '(no exp claim)'}. Grab a fresh one.`)
  process.exit(1)
}
const uid = claims.external_id || claims.sub || ''
console.log(`Token valid for ${Math.round((claims.exp - now) / 60)} more min.`)
console.log(`Resolves to ${claims.external_id ? 'external_id' : 'sub'} ending ${String(uid).slice(-6)} (${claims.external_id ? 'WorkOS-issued' : 'Supabase-issued'}).`)

/**
 * Playwright is not a dependency of this repo. Resolve a local devDependency first,
 * then a global install. The global package is CommonJS, so the namespace exposes
 * chromium under `default` — read both, or this silently yields undefined.
 */
async function loadChromium() {
  const specs = ['playwright']
  try {
    const { execFileSync } = await import('node:child_process')
    const { pathToFileURL } = await import('node:url')
    const { join } = await import('node:path')
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).trim()
    if (root) specs.push(pathToFileURL(join(root, 'playwright', 'index.js')).href)
  } catch { /* no global npm root; local-only is fine */ }

  for (const spec of specs) {
    try {
      const mod = await import(spec)
      const c = mod.chromium ?? mod.default?.chromium
      if (c) return c
    } catch { /* try the next location */ }
  }
  return null
}

const chromium = await loadChromium()
if (!chromium) {
  console.error('Playwright not found locally or globally:  npm i -D playwright')
  process.exit(1)
}

const TABS = ['State', 'Federal']
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

/**
 * ONE context, ONE page load, then eight shots by manipulating the live page.
 *
 * 🔴 These tokens are SHORT-LIVED — minutes, not hours. Reloading per combination
 * spent the whole budget on eight cold boots and the token expired mid-run. Switching
 * tabs by click (what AppShell actually does) is both faster and more faithful: every
 * feed panel is already mounted, so a tab switch is a CSS reveal, not a fetch.
 */
const ctx = await browser.newContext({ viewport: VIEWPORTS[0], deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.addInitScript((t) => localStorage.setItem('cs_token', t), token)
await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })

try {
  await page.waitForSelector('[aria-label="Slice tabs"]', { timeout: 20000 })
} catch {
  const body = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\s+/g, ' '))
  console.error('Never reached the signed-in shell. Page said:')
  console.error(`  ${body}`)
  console.error(errors.length ? `  errors: ${errors.slice(0, 3).join(' | ')}` : '')
  await browser.close()
  process.exit(1)
}
console.log('Signed-in shell reached.')

for (const tab of TABS) {
  try {
    await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click({ timeout: 10000 })
  } catch (e) {
    console.error(`could not click the ${tab} tab: ` + String(e).slice(0, 120))
    continue
  }
  await page.waitForTimeout(1500) // let the banner image decode + fade in

  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => {
      localStorage.setItem('ev:color-scheme', t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    }, theme)

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.waitForTimeout(600)

      const seen = await page.evaluate(() => {
        const h2 = document.querySelector('h2')
        const img = [...document.querySelectorAll('img')].find((i) => i.naturalWidth > 400)
        const credit = [...document.querySelectorAll('p')]
          .map((p) => (p.textContent || '').trim())
          .find((t) => /via Wikimedia|via Wikipedia/.test(t))

        // 🔴 THE ACTUAL REGRESSION TEST. The banner bug was never a render failure — the
        // banner existed and had been scrolled off by the browser's scroll anchoring when
        // it was inserted above already-laid-out posts. A screenshot alone cannot tell
        // "no banner" from "banner scrolled out of view", so measure it: the feed's
        // scrollTop must be 0 on arrival, and the banner's top must be inside the box.
        const scroller = [...document.querySelectorAll('div')].find(
          (d) => d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflowY === 'auto'
        )
        const banner = img ? img.closest('div[class*="aspect-"]') : null
        const sr = scroller ? scroller.getBoundingClientRect() : null
        const br = banner ? banner.getBoundingClientRect() : null
        return {
          heading: h2 ? h2.textContent : null,
          banner: img ? img.src.split('/').slice(-2).join('/') : null,
          credit: credit || null,
          scrollTop: scroller ? Math.round(scroller.scrollTop) : null,
          bannerVisible: sr && br ? br.bottom > sr.top && br.top < sr.bottom : null,
        }
      })

      await page.screenshot({ path: `${OUT}/${tab.toLowerCase()}-${theme}-${vp.name}.png` })
      console.log(
        `${tab}/${theme}/${vp.name}: scrollTop=${seen.scrollTop} bannerVisible=${seen.bannerVisible} ` +
          `banner=${seen.banner} credit=${seen.credit ? 'yes' : 'NONE'} h2="${seen.heading}"`
      )
    }
  }
}

if (errors.length) console.log(`
console/page errors: ${errors.slice(0, 3).join(' | ')}`)
await ctx.close()
await browser.close()
console.log(`\n8 screenshots in ${OUT}/. LOOK AT THEM. Then delete ${TOKEN_FILE}.`)
