#!/usr/bin/env node
/**
 * shoot-welcome.mjs — the four-way visual pass over the signed-out arrival.
 *
 *   npm run dev
 *   npm run shoot:welcome [-- --port 5174] [-- --out welcome-shots]
 *
 * No credential. The two place legs are stubbed from the committed fixtures in
 * `scripts/fixtures/`, exactly as `check-place-entry.mjs` does, so the run is
 * deterministic and offline and every cell is the same place every time.
 *
 * ── 🔴 A CLEAN RUN ONLY PROVES THE PNGs DECODED ──────────────────────────────
 *
 * `16-VALIDATION.md` says so and Phase 16 found it to be true more than once: a
 * script that exits 0 having written 24 images has verified that 24 images are
 * writable. **LOOK AT THEM.** This script's only job is to put the right pixels
 * in front of a human and to print, beside each cell, what was actually on
 * screen — because a screenshot cannot tell "absent" from "scrolled out of
 * view", and three of the questions worth asking are measurements rather than
 * impressions:
 *
 *   · is the primary action above the fold at 390x844?
 *   · does anything overflow horizontally?
 *   · did the page render the thing this cell is named after at all?
 *
 * All three are printed per cell. The judgement is still the human's.
 *
 * ── The matrix ───────────────────────────────────────────────────────────────
 *
 * Six presentations x two themes x two viewports = 24 cells.
 *
 *   1 welcome      the welcome screen, signed out, nothing chosen
 *   2 results      the picker open with results
 *   3 no-results   the picker with NO results — the honest line
 *   4 explore      a visited place, Explore, signed out
 *   5 conversations a visited place, Conversations — the honest unavailable state
 *   6 member       a visited place, signed in (?dev=1), place strip and sidebar
 *
 * Per cell, two kinds of image, which is `shoot-explore.mjs`'s convention and is
 * kept because the two answer different questions:
 *
 *   {cell}-full.png    the whole document in one strip. Answers "does this read
 *                      as one screen, or as a wall?" Too tall to read small print.
 *   {cell}-f1..fN.png  viewport frames walking down the page. The only ones small
 *                      print is legible in, and the ones the copy is read from.
 *
 * ── 🔴 The theme is ASSERTED, never assumed ──────────────────────────────────
 *
 * Playwright's `colorScheme` context option does NOTHING in this app. The
 * bootstrap in `index.html` reads the `ev_color_scheme` cookie before first
 * paint and deliberately ignores `prefers-color-scheme` — it tests
 * `s !== 'light'`, not `s === 'dark'`. A run that does not assert this silently
 * produces 24 dark images and reports a four-way pass, which is worse than no
 * run because it looks like coverage.
 *
 * So the cookie is set on the CONTEXT, `documentElement.classList` is checked
 * against it before every single shot, a mismatch is a hard stop, and the
 * ASSERTED theme is in the filename — `1-welcome-light-390-f1.png` — so a
 * mislabelled image is visible in a directory listing rather than only in a
 * viewer.
 *
 * ── Playwright, the repo's way ───────────────────────────────────────────────
 *
 * 🔴 It is a GLOBAL install here, not a dependency — `node_modules` is the wrong
 * place to look. `loadChromium` below is copied from `check-explore-gate.mjs`
 * rather than re-derived, including the `mod.chromium ?? mod.default?.chromium`
 * read: the global package's export shape differs between its CJS and ESM entry
 * points.
 *
 */
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = arg('--port', '5173')
const OUT = arg('--out', 'welcome-shots')
const ORIGIN = `http://localhost:${PORT}`
const WANT_SHOTS = true

// ── Selectors, shared with check-place-entry.mjs ─────────────────────────────

const WELCOME = '[data-welcome-screen]'
const PICKER = '[data-place-picker]'
const HERO_PICKER = '[data-place-picker="hero"]'
const PROBLEM = '[data-place-picker-problem]'
const STRIP = '[data-place-strip]'
const LEAVE = '[data-place-strip-leave]'
const PANEL = '#forum-view-explore'
const FEED_PANEL = '#forum-view-conversations'

/** The place every cell lands on, and the query the no-results fixture answers. */
const PLACE_QUERY = 'asheville'
const NO_MATCH = 'zzzqqqxnotaplace'

const DESKTOP = { width: 1440, height: 1000 }
const MOBILE = { width: 390, height: 844 }
const VIEWPORTS = [DESKTOP, MOBILE]
const THEMES = ['light', 'dark']

/**
 * Console noise the dev fixtures produce by design. `CLAUDE.md` records that
 * member-only APIs 401 for the dev id and that the accounts session endpoint
 * sends no CORS header for localhost. Suppressed lines are COUNTED and the
 * first of each is PRINTED, so this allowlist cannot quietly become a place a
 * real error hides.
 */
const EXPECTED_NOISE = [/Failed to load resource/, /blocked by CORS policy/, /net::ERR_/]

/**
 * Playwright is not a dependency of this repo — it is a GLOBAL install, so
 * node_modules is the wrong place to look. Resolve a local devDependency first,
 * then the global root. The global package is CommonJS, so the namespace exposes
 * chromium under `default`: read both, or this silently yields undefined.
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

// ── Fixtures and the stubs that serve them ───────────────────────────────────

async function readFixtures() {
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const here = dirname(fileURLToPath(import.meta.url))
  const load = async (name) => JSON.parse(await readFile(join(here, 'fixtures', name), 'utf8'))
  return {
    asheville: (await load('place-search-asheville.json')).rows,
    none: (await load('place-search-no-results.json')).rows,
    coordinates: (await load('coordinate-lookup-asheville.json')).body,
  }
}

/**
 * Only the two RESOLUTION legs are stubbed. Banners, meetings, elections,
 * compass topics and the by-area officials reach the network exactly as they do
 * for a real visitor — they are what these images are of, and faking them would
 * be shooting the fixtures rather than the page.
 */
async function stubPlaceLegs(page, fx) {
  await page.route('**/api/essentials/location-search*', (route) => {
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase()
    const rows = q.includes(NO_MATCH) ? fx.none : fx.asheville
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await page.route('**/api/essentials/coordinate-lookup', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx.coordinates) }),
  )
}

// ── Page-side readers (one serialisable argument each) ───────────────────────

/**
 * What a cell is allowed to claim about itself, measured rather than assumed.
 *
 * `aboveFold` is the question the plan asks by name: on a 390x844 phone, is the
 * welcome screen's PRIMARY action — the picker input — on screen without a
 * scroll? Reported as the input's own rect against `innerHeight`, so a reader
 * can see how much margin there is rather than a bare yes.
 */
function readCell({ picker, panel, feed, strip, welcome }) {
  const vis = (el) => !!el && el.offsetParent !== null
  const doc = document.documentElement
  const input = document.querySelector(`${picker} input[role="combobox"]`)
  const rect = input ? input.getBoundingClientRect() : null
  const p = document.querySelector(panel)
  const f = document.querySelector(feed)
  return {
    docHeight: Math.max(doc.scrollHeight, document.body.scrollHeight),
    innerHeight: window.innerHeight,
    // A horizontal scrollbar at 390 is the second question the plan asks.
    overflowX: doc.scrollWidth - doc.clientWidth,
    dark: doc.classList.contains('dark'),
    welcome: !!document.querySelector(welcome),
    pickerInput: !!input,
    pickerTop: rect ? Math.round(rect.top) : null,
    pickerBottom: rect ? Math.round(rect.bottom) : null,
    aboveFold: rect ? rect.bottom <= window.innerHeight && rect.top >= 0 : null,
    options: document.querySelectorAll(`${picker} [role="option"]`).length,
    problem: (document.querySelector('[data-place-picker-problem]')?.innerText || '').trim(),
    strip: document.querySelector(strip)?.getAttribute('data-place-strip') ?? null,
    stripText: (document.querySelector(strip)?.innerText || '').replace(/\s+/g, ' ').trim(),
    hero: document.querySelector('h2')?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
    explore: vis(p) ? [...p.querySelectorAll('[data-explore-module]')].map((d) => d.dataset.exploreModule) : null,
    conversations: vis(f) ? (f.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 180) : null,
    notice: document.querySelector('[data-read-only-notice]')?.getAttribute('data-read-only-notice') ?? null,
    // The sidebar is `hidden` below md and collapsible above it; reported, never
    // assumed, and read by its widget's own title rather than by a marker that
    // would have to be added to a component for a screenshot's benefit.
    sidebar: /Representing This Community/i.test(document.body.innerText || ''),
    textLen: (document.body.innerText || '').length,
  }
}

// ── Harness ──────────────────────────────────────────────────────────────────

const chromium = await loadChromium()
if (!chromium) {
  console.error('Playwright not found locally or globally. It is a GLOBAL install here —')
  console.error('node_modules is the wrong place to look. See CLAUDE.md.')
  process.exit(1)
}

if (WANT_SHOTS) {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  for (const f of readdirSync(OUT)) if (f.endsWith('.png')) unlinkSync(`${OUT}/${f}`)
}

const fx = await readFixtures()
const browser = await chromium.launch()

const written = []
const cells = []
const notes = []
const errors = { page: [], console: [], noise: [] }

function attachErrorSinks(page) {
  page.on('pageerror', (e) => errors.page.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    ;(EXPECTED_NOISE.some((re) => re.test(t)) ? errors.noise : errors.console).push(t)
  })
}

async function freshContext(theme, viewport, { reducedMotion } = {}) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    ...(reducedMotion ? { reducedMotion: 'reduce' } : {}),
  })
  await ctx.addCookies([{ name: 'ev_color_scheme', value: theme, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()
  attachErrorSinks(page)
  await stubPlaceLegs(page, fx)
  return { ctx, page }
}

/**
 * 🔴 Asserted, never assumed, and a hard stop on mismatch.
 *
 * The cookie is the only thing that decides the theme (see the header), so the
 * class on <html> is the only evidence the cell is the theme it is named after.
 * Every shot goes through this.
 */
async function assertTheme(page, theme, where) {
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  if (dark !== (theme === 'dark')) {
    throw new Error(
      `theme ${theme} did not apply at ${where} — documentElement.dark=${dark}. ` +
        'The ev_color_scheme cookie is the switch; Playwright colorScheme does nothing here.',
    )
  }
}

/**
 * One cell: the whole document as one strip, then viewport frames down it.
 *
 * The theme is asserted immediately before the first pixel is written, not at
 * page load — a cell that drifted mid-walk would otherwise be labelled by the
 * theme it started in.
 */
async function shootCell(page, cell, theme, vp) {
  await assertTheme(page, theme, cell)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  const seen = await page.evaluate(readCell, {
    picker: PICKER, panel: PANEL, feed: FEED_PANEL, strip: STRIP, welcome: WELCOME,
  })

  if (WANT_SHOTS) {
    await page.screenshot({ path: `${OUT}/${cell}-full.png`, fullPage: true })
    written.push(`${cell}-full.png`)
    const frames = Math.min(12, Math.max(1, Math.ceil(seen.docHeight / vp.height)))
    for (let i = 0; i < frames; i += 1) {
      await page.evaluate((y) => window.scrollTo(0, y), i * vp.height)
      await page.waitForTimeout(350)
      await page.screenshot({ path: `${OUT}/${cell}-f${i + 1}.png` })
      written.push(`${cell}-f${i + 1}.png`)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(250)
    seen.frames = frames
  }

  cells.push({ cell, seen })
  return seen
}

function reportCell(cell, seen) {
  const bits = [
    `dark=${seen.dark}`,
    `doc=${seen.docHeight}px`,
    `overflowX=${seen.overflowX}`,
  ]
  if (seen.pickerInput) bits.push(`picker ${seen.pickerTop}→${seen.pickerBottom} aboveFold=${seen.aboveFold}`)
  if (seen.options) bits.push(`options=${seen.options}`)
  if (seen.strip) bits.push(`strip=${seen.strip}`)
  if (seen.notice) bits.push(`notice=${seen.notice}`)
  console.log(`  ${cell}`)
  console.log(`      ${bits.join('  ·  ')}`)
  if (seen.hero) console.log(`      h2        "${seen.hero.slice(0, 90)}"`)
  if (seen.problem) console.log(`      problem   "${seen.problem}"`)
  if (seen.stripText) console.log(`      strip     "${seen.stripText.slice(0, 110)}"`)
  if (seen.explore) console.log(`      explore   [${seen.explore.join(', ')}]`)
  if (seen.conversations) console.log(`      convos    "${seen.conversations.slice(0, 110)}"`)
  if (seen.overflowX > 0) notes.push(`🔴 ${cell}: horizontal overflow of ${seen.overflowX}px`)
  if (seen.pickerInput && seen.aboveFold === false) {
    notes.push(`🔴 ${cell}: the picker input is NOT above the fold (top ${seen.pickerTop}, viewport ${seen.innerHeight})`)
  }
}

// ── The walks ────────────────────────────────────────────────────────────────

/** Type into a picker, from empty, and wait for the list (or the honest line). */
async function typeInto(page, scope, text, { expectOptions = true } = {}) {
  const input = page.locator(`${scope} input[role="combobox"]`)
  await input.click()
  await input.fill('')
  await input.fill(text)
  // 🔴 Not padding. `usePlaceSearch` debounces at 250ms and the stub answers
  // every query, so a run that waited only for `[role="option"]` would be
  // satisfied by the PREVIOUS query's list and shoot the wrong one.
  await page.waitForTimeout(900)
  if (expectOptions) await page.waitForSelector(`${scope} [role="option"]`, { timeout: 15000 })
  else await page.waitForTimeout(700)
}

/** Wait until the shell replaced the welcome screen. Never a bare selector wait. */
async function settle(page, timeout = 25000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const state = await page.evaluate(
      ({ p, w }) => {
        const panel = document.querySelector(p)
        if (panel && panel.offsetParent !== null) return 'shell'
        if (document.querySelector(w)) return 'welcome'
        return 'neither'
      },
      { p: PANEL, w: WELCOME },
    )
    if (state === 'shell') return 'shell'
    await page.waitForTimeout(400)
  }
  return 'stuck'
}

async function goToView(page, view) {
  await page.getByRole('tab', { name: view === 'explore' ? /Explore/i : /Conversations/i }).click()
  await page.waitForTimeout(1000)
}

/**
 * Presentations 1-5, signed out, in ONE page load.
 *
 * `?signedout=1` is 17-01's dev-only, session-scoped visitor switch — it is
 * checked FIRST, before the hash, localStorage and silent-SSO paths, because it
 * only ever REMOVES a session and so can confer no privilege. On a fresh clone
 * it is the only way to reach this screen at all: with no VITE_SUPABASE_URL,
 * `useAuth` enters dev-guest mode unconditionally, so dropping `?dev=1` does
 * NOT sign you out.
 */
async function walkSignedOut(theme, vp, tag) {
  const { ctx, page } = await freshContext(theme, vp)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(WELCOME, { timeout: 25000 })
  await page.waitForTimeout(2200)
  await assertTheme(page, theme, `${tag} (boot)`)

  // 1 — nothing chosen
  reportCell(`1-welcome-${tag}`, await shootCell(page, `1-welcome-${tag}`, theme, vp))

  // 2 — the picker open, with results
  await typeInto(page, HERO_PICKER, PLACE_QUERY)
  reportCell(`2-results-${tag}`, await shootCell(page, `2-results-${tag}`, theme, vp))

  // 3 — the picker with NO results: the honest line, not a blank list
  await typeInto(page, HERO_PICKER, NO_MATCH, { expectOptions: false })
  await page.waitForSelector(PROBLEM, { timeout: 15000 })
  reportCell(`3-no-results-${tag}`, await shootCell(page, `3-no-results-${tag}`, theme, vp))

  // 4 — a real place, Explore
  await typeInto(page, HERO_PICKER, PLACE_QUERY)
  await page.locator(`${HERO_PICKER} [role="option"]`).first().click()
  const state = await settle(page)
  if (state !== 'shell') throw new Error(`${tag}: the place never resolved — settled on "${state}"`)
  await page.waitForTimeout(2500)
  await goToView(page, 'explore')
  reportCell(`4-explore-${tag}`, await shootCell(page, `4-explore-${tag}`, theme, vp))

  // 5 — the same place, Conversations: the honest unavailable state
  await goToView(page, 'conversations')
  reportCell(`5-conversations-${tag}`, await shootCell(page, `5-conversations-${tag}`, theme, vp))

  await ctx.close()
}

/**
 * Presentation 6 — a signed-in member visiting ANOTHER place, with the place
 * strip and the sidebar. `cs_active_tab` is planted before first paint because
 * the app otherwise lands on `federal`, and City is where the sidebar's
 * officials and the strip are both worth looking at.
 *
 * 🔴 `&place=bloomington`, NOT a bare `?dev=1`, and the reason is a finding this
 * run made rather than a preference.
 *
 * The bare dev guest lives in **Asheville** — which is also the place every cell
 * in this script resolves. So the first draft of presentation 6 was a member
 * entering THEIR OWN CITY, and the notice it shot read `sibling-shard`:
 * *"You're exploring Slice — read-only"*, with an em-dash where the shard number
 * should be, because `placeSlices()` hands `whyNoWrite` a `place:` sentinel id
 * that is not in `ownedSliceIds` while `placeKey('city','3702140')` IS in
 * `ownedPlaceKeys` — branch 4. `check:explore-gate`'s `member-other-place`
 * viewer never sees it because that viewer boots on `&place=bloomington` and so
 * is genuinely somewhere else. Logged as item 4 of this phase's
 * `deferred-items.md`; this cell is about a member at a place that is NOT
 * theirs, which is the state the phase is for, so it boots in Bloomington.
 */
async function walkMember(theme, vp, tag) {
  const { ctx, page } = await freshContext(theme, vp)
  await page.addInitScript(() => {
    try { localStorage.setItem('cs_active_tab', 'city') } catch { /* blocked storage is item 1 */ }
  })
  await page.goto(`${ORIGIN}/?dev=1&place=bloomington`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(STRIP, { timeout: 25000 })
  await page.waitForTimeout(3000)
  await assertTheme(page, theme, `${tag} (boot)`)

  // The strip's own entry point — D-19's second one, the SAME PlacePicker.
  await page.locator(`${STRIP} button[aria-expanded]`).first().click()
  await page.waitForTimeout(500)
  await typeInto(page, '[data-place-picker="compact"]', PLACE_QUERY)
  await page.locator('[data-place-picker="compact"] [role="option"]').first().click()
  await page.waitForTimeout(3000)
  const visiting = await page.evaluate((s) => document.querySelector(s)?.getAttribute('data-place-strip'), STRIP)
  if (visiting !== 'visiting') throw new Error(`${tag}: the member never entered the place (strip="${visiting}")`)
  await goToView(page, 'explore')
  const seen = await shootCell(page, `6-member-${tag}`, theme, vp)
  reportCell(`6-member-${tag}`, seen)
  // 🔴 Named, not assumed. If this cell ever shoots `sibling-shard` again it is
  // the self-visit above, and the image would look plausible while showing the
  // wrong state entirely.
  if (seen.notice !== 'other-place') {
    notes.push(`🔴 6-member-${tag}: the notice reads "${seen.notice}", not "other-place" — see the comment on walkMember`)
  }
  if (!seen.sidebar && vp.width >= 768) {
    notes.push(`🔴 6-member-${tag}: no "Representing This Community" widget — the sidebar this cell exists to show is absent`)
  }

  await ctx.close()
}

// ── Run ──────────────────────────────────────────────────────────────────────

console.log(`\nshoot-welcome — ${ORIGIN} → ${OUT}/`)
console.log(`six presentations x ${THEMES.length} themes x ${VIEWPORTS.length} viewports = ${6 * THEMES.length * VIEWPORTS.length} cells\n`)

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const tag = `${theme}-${vp.width}`
    console.log(`── ${theme.toUpperCase()} · ${vp.width}x${vp.height} ${'─'.repeat(34)}`)
    await walkSignedOut(theme, vp, tag)
    await walkMember(theme, vp, tag)
    console.log('')
  }
}

await browser.close()

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('── WHAT WAS ON SCREEN ──────────────────────────────────────────')
console.log(`  ${cells.length} cells, ${written.length} images in ${OUT}/`)

if (errors.noise.length) {
  console.log(`  (noise) ${errors.noise.length} expected dev-id network errors suppressed: ${[...new Set(errors.noise.map((t) => t.slice(0, 60)))].slice(0, 3).join(' | ')}`)
}
if (errors.page.length || errors.console.length) {
  console.log(`  🔴 ${errors.page.length} uncaught page error(s), ${errors.console.length} unexpected console error(s)`)
  for (const e of [...errors.page, ...errors.console].slice(0, 8)) console.log(`      ${e.slice(0, 160)}`)
  notes.push(`🔴 ${errors.page.length + errors.console.length} page/console error(s) during the run`)
}

if (notes.length) {
  console.log('\n── MEASURED FINDINGS ───────────────────────────────────────────')
  for (const n of notes) console.log(`  ${n}`)
} else {
  console.log('\n  No measured finding: no horizontal overflow, the picker above the fold everywhere, no page errors.')
}

console.log('\n🔴 THAT IS NOT A PASS. These measurements cannot see a colour that only')
console.log('   exists in one mode, copy that overclaims, or a layout that is merely ugly.')
console.log(`   OPEN ${OUT}/ AND LOOK AT THE IMAGES — that is the task; this was its setup.\n`)

if (errors.page.length || errors.console.length) process.exit(1)
