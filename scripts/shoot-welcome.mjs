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
/**
 * `--audit` adds the contrast, hit-test and reduced-motion pass to the same run.
 * `--audit-only` skips the 24 cells, which is the flag to use while iterating on
 * a colour: the images take about three minutes and the audit about one.
 */
const WANT_AUDIT = process.argv.includes('--audit') || process.argv.includes('--audit-only')
const WANT_SHOTS = !process.argv.includes('--audit-only')

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

// ═════════════════════════════════════════════════════════════════════════════
// AUDIT — contrast through a canvas, hit-tests at both viewports, reduced motion
// ═════════════════════════════════════════════════════════════════════════════

const RAIL_SEL = 'nav[aria-label="Civic space navigation"]'
const TABBAR_SEL = 'nav[aria-label="Slice tabs"]'
const rosters = []

let auditPass = 0
let auditFail = 0
const auditSkips = []

function aCheck(label, ok, detail) {
  if (ok) {
    auditPass += 1
    console.log(`  PASS  ${label}`)
  } else {
    auditFail += 1
    console.log(`  FAIL  ${label}${detail === undefined ? '' : `\n            ${detail}`}`)
    notes.push(`🔴 audit: ${label}`)
  }
}

function aSkip(label, why) {
  auditSkips.push(`${label} — ${why}`)
  console.log(`  SKIP  ${label}\n            ${why}`)
}

/**
 * 🔴 A GROUP THAT CANNOT RUN MUST FAIL, NOT CRASH.
 *
 * 17-06 paid for this one: hiding the control `readNotOverGated` exists to
 * catch made every locator in it time out, and the unguarded throw killed the
 * whole process — no FAIL line, no summary, no sign of which viewer had got
 * that far. 17-VALIDATION.md records it as a finding in its own right.
 *
 * This audit reproduced it exactly. The hit-test revert — `pointer-events-none`
 * on the picker input, which is the PR #92 failure in miniature — made
 * `typeInto`'s click time out, and the run died with a Playwright stack trace
 * BEFORE the hit-test assertion the revert was aimed at. A crashed run tells
 * you less than a failed one.
 */
async function guarded(label, fn) {
  try {
    await fn()
  } catch (e) {
    aCheck(label, false, `the group could not run: ${String(e).split('\n')[0].slice(0, 180)}`)
  }
}

/**
 * 🔴 THE CONTRAST PROBE, AND THE ONE WAY IT WORKS.
 *
 * Tailwind v4 emits `oklch()`. Two probes that look right and are not:
 *
 *   1. parse `getComputedStyle(el).color` as `rgb()` — Chromium hands back the
 *      `oklch()` string and the parse produces confident nonsense.
 *   2. set `ctx.fillStyle = colour` and READ IT BACK — Chromium ACCEPTS the
 *      oklch string and returns it verbatim, so `0.446 0.03 256.802` gets parsed
 *      as if it were RGB and a perfectly legible body colour reports ~1:1.
 *
 * 🔴 The only thing that resolves a colour is making the GPU paint it:
 * `fillRect`, then `getImageData` one pixel. That is what `px()` below does.
 *
 * A ratio near 1:1, or a whole page "failing", is bug 2 and not a finding. If
 * you ever see that again, fix the probe before you touch a colour.
 *
 * ── And the second half, which a naive probe also gets wrong ────────────────
 *
 * Half this app's surfaces are TRANSLUCENT — `dark:bg-amber-400/10`,
 * `dark:border-white/15`, `bg-brand/20`. Compositing one pixel of an `rgba()`
 * over an assumed white would report the light-mode answer for a dark-mode
 * surface. So every colour is resolved for its ALPHA too, by painting it over
 * black and over white and solving the two equations:
 *
 *     over white: Cw = a·C + (1-a)·255
 *     over black: Cb = a·C
 *       ⇒  a = 1 - (Cw - Cb)/255,  C = Cb/a
 *
 * and the element's effective background is built by compositing every ancestor
 * background from the document down, which is what a browser actually does.
 */
function auditProbe({ items, big }) {
  // One canvas, reused. willReadFrequently keeps getImageData off the GPU path.
  const cv = document.createElement('canvas')
  cv.width = 2
  cv.height = 1
  const ctx = cv.getContext('2d', { willReadFrequently: true })

  /** Paint `colour` over `under` and read the one pixel back. */
  function px(colour, under) {
    ctx.clearRect(0, 0, 2, 1)
    ctx.fillStyle = under
    ctx.fillRect(0, 0, 2, 1)
    ctx.fillStyle = colour
    // 🔴 fillRect, then getImageData. Reading ctx.fillStyle back is NOT this.
    ctx.fillRect(0, 0, 2, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]]
  }

  /** Resolve any CSS colour string to straight {r,g,b,a}, alpha included. */
  function resolve(colour) {
    if (!colour || colour === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    const w = px(colour, '#ffffff')
    const b = px(colour, '#000000')
    const a = 1 - (w[0] - b[0]) / 255
    if (a <= 0.004) return { r: 0, g: 0, b: 0, a: 0 }
    return { r: b[0] / a, g: b[1] / a, b: b[2] / a, a }
  }

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })

  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  const ratio = (x, y) => {
    const a = lum(x)
    const b = lum(y)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }

  /** The background a browser would actually paint behind this element. */
  function backdrop(el) {
    const stack = []
    for (let n = el; n; n = n.parentElement) stack.push(n)
    // The document's own canvas colour is the floor.
    let base = resolve(getComputedStyle(document.documentElement).backgroundColor)
    if (base.a === 0) base = resolve(getComputedStyle(document.body).backgroundColor)
    let acc = base.a === 0 ? { r: 255, g: 255, b: 255, a: 1 } : { ...base, a: 1 }
    for (const n of stack.reverse()) {
      const bg = resolve(getComputedStyle(n).backgroundColor)
      if (bg.a > 0) acc = over(bg, acc)
    }
    return acc
  }

  const out = []
  for (const item of items) {
    const el = document.querySelector(item.sel)
    if (!el || el.offsetParent === null) {
      out.push({ ...item, found: false })
      continue
    }
    const cs = getComputedStyle(el)
    const fgRaw = item.icon ? (cs.stroke !== 'none' && cs.stroke ? cs.stroke : cs.color) : cs.color
    const fg = resolve(fgRaw)
    const bg = backdrop(el)
    const composited = over(fg, bg)
    const size = parseFloat(cs.fontSize) || 16
    const weight = parseInt(cs.fontWeight, 10) || 400
    const isBig = !item.icon && (size >= 24 || (size >= 18.66 && weight >= 700))
    out.push({
      ...item,
      found: true,
      ratio: Math.round(ratio(composited, bg) * 100) / 100,
      need: item.icon ? 3 : isBig && big ? 3 : 4.5,
      big: isBig,
      size: Math.round(size),
      raw: String(fgRaw).slice(0, 40),
      text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48),
    })
  }
  return out
}

/** elementFromPoint at a control's centre: does a click actually land on it? */
function auditHit({ sels }) {
  return sels.map(({ sel, label }) => {
    const el = document.querySelector(sel)
    if (!el) return { label, found: false }
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return { label, found: true, ok: false, why: 'zero-size box' }
    if (r.bottom < 0 || r.top > window.innerHeight) {
      el.scrollIntoView({ block: 'center' })
    }
    const r2 = el.getBoundingClientRect()
    const cx = r2.left + r2.width / 2
    const cy = r2.top + r2.height / 2
    if (cy < 0 || cy > window.innerHeight) return { label, found: true, ok: false, why: `off-screen (top ${Math.round(r2.top)})` }
    const at = document.elementFromPoint(cx, cy)
    return {
      label,
      found: true,
      /**
       * 🔴 `at === el || el.contains(at)` — and NOT `at.contains(el)`, which a
       * first draft of this function also allowed and which quietly made the
       * whole assertion vacuous. An element covered by a transparent ANCESTOR
       * — which is the PR #92 shape, a padded content layer at `z-10` over a
       * credit link — returns that ancestor from elementFromPoint, and an
       * ancestor contains its own descendant by definition. The permissive
       * clause therefore reports a blocked control as reachable. Proved by
       * setting `pointer-events: none` on the picker input mid-run: with the
       * third clause the assertion stayed green; without it, it goes red.
       */
      ok: !!at && (at === el || el.contains(at)),
      size: `${Math.round(r2.width)}x${Math.round(r2.height)}`,
      blockedBy: at ? `${at.tagName.toLowerCase()}.${String(at.className || '').split(' ')[0]}` : 'nothing',
    }
  })
}

/** Is anything on this screen animating, and does the app see the preference? */
function auditMotion() {
  const running = document
    .getAnimations()
    .filter((a) => a.playState === 'running')
    .map((a) => `${a.effect?.target?.tagName?.toLowerCase() ?? '?'}.${String(a.effect?.target?.className || '').split(' ')[0]}`)
  const moving = [...document.querySelectorAll('[data-welcome-screen] *, [data-place-picker] *')]
    .filter((el) => {
      const cs = getComputedStyle(el)
      const dur = (s) => s.split(',').some((v) => parseFloat(v) > 0)
      return dur(cs.transitionDuration) || dur(cs.animationDuration)
    })
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}`)
  return {
    // 🔴 Asserted. `prefers-reduced-motion` IS consumed by CSS here (unlike the
    // colour scheme, which the cookie bootstrap owns), so Playwright's
    // reducedMotion emulation does work — but a run that does not confirm the
    // media query matched is the same vacuous shape as an unasserted theme.
    matched: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    running,
    moving: [...new Set(moving)],
  }
}

/** The roster the sidebar is RENDERING, for the one read no script can do. */
function auditRoster() {
  const body = document.body.innerText || ''
  const i = body.search(/Representing This Community/i)
  if (i < 0) return { present: false }
  return {
    present: true,
    text: body.slice(i, i + 700).replace(/\s+/g, ' ').trim(),
  }
}

/**
 * The welcome screen's probe list. Every line the plan names, by selector.
 *
 * 🔴 EACH SELECTOR MUST RESOLVE TO THE ELEMENT ITS LABEL NAMES, and the probe
 * reads `querySelector` — the FIRST match, not all of them. A descendant
 * selector plus `:last-of-type` is the trap, because `:last-of-type` is scoped
 * to each element's own SIBLINGS rather than to the match set: `header
 * p:last-of-type` matched two nodes here, and the first was the 18px "Civic
 * Spaces" wordmark nested in a div, not the 14px strapline beneath it. So the
 * assertion printed "the strapline under the mark — N:1" while measuring
 * something else, at a size that scored it against the 3:1 large-text floor
 * instead of 4.5:1.
 *
 * That is worse than a missing assertion. A missing one is silent; this one
 * reports a PASS on a line it never looked at, and a reader believes it. Proved
 * by breaking the real strapline to 2.6:1 light / 2.35:1 dark — all 140
 * assertions stayed green. `header > p` is the child combinator, which excludes
 * the nested wordmark and leaves exactly one match.
 *
 * The sign-in sentence was simply absent, and it is the one that carries BOTH
 * WALLS for a returning member ("an account without one opens none yet"). It
 * shares a parent with the EV footer, so `:last-of-type` claimed the footer and
 * nothing claimed it. Added as `:first-of-type`, the symmetric half.
 *
 * When you add a line here, confirm what it resolves to on the live page before
 * trusting the PASS — `document.querySelectorAll(sel).length` must be 1.
 */
const WELCOME_ITEMS = [
  { sel: '[data-welcome-screen] h2', what: 'the headline' },
  { sel: '[data-welcome-screen] header > p:last-of-type', what: 'the strapline under the mark' },
  { sel: '[data-welcome-screen] h2 + p', what: 'the lead body copy' },
  { sel: '[data-place-picker="hero"] label', what: "the picker's visible label" },
  { sel: '[data-place-picker="hero"] input[role="combobox"]', what: "the picker's input text" },
  { sel: '[data-place-picker="hero"] p[id]', what: "the picker's help line" },
  { sel: '[data-welcome-screen] blockquote p', what: "Chris's line" },
  { sel: '[data-welcome-screen] blockquote footer', what: 'its attribution' },
  { sel: '[data-welcome-screen] section:last-of-type h3', what: 'the privacy block heading' },
  { sel: '[data-welcome-screen] section:last-of-type p', what: 'the privacy block body' },
  { sel: '[data-welcome-screen] section:last-of-type span svg', what: 'the privacy block icon', icon: true },
  { sel: '[data-welcome-screen] > div > p:first-of-type', what: 'the sign-in sentence, which carries both walls' },
  { sel: '[data-welcome-screen] > div > p:last-of-type', what: 'the EV strapline footer' },
]

async function auditWelcome(theme, vp, tag) {
  const { ctx, page } = await freshContext(theme, vp)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(WELCOME, { timeout: 25000 })
  await page.waitForTimeout(2200)
  await assertTheme(page, theme, `audit ${tag}`)

  // ── Contrast, the welcome screen ──
  const items = await page.evaluate(auditProbe, { items: WELCOME_ITEMS, big: true })
  for (const r of items) {
    if (!r.found) {
      aSkip(`contrast ${tag} · ${r.what}`, `no visible element matched ${r.sel}`)
      continue
    }
    aCheck(
      `contrast ${tag} · ${r.what} — ${r.ratio}:1 (needs ${r.need}) ${r.size}px${r.big ? ' large' : ''}`,
      r.ratio >= r.need,
      `computed "${r.raw}" over its composited backdrop · "${r.text}"`,
    )
  }

  // ── Hit-test the PRIMARY action FIRST, before anything has to click it ──
  // 🔴 Order matters and this is the second lesson the revert matrix taught.
  // The hit-test used to sit after `typeInto`, so making the input unclickable
  // — the one bug this assertion exists for — stopped the run at the typing
  // instead of failing at the assertion.
  const firstHits = await page.evaluate(auditHit, {
    sels: [
      { sel: `${HERO_PICKER} input[role="combobox"]`, label: 'the picker input' },
      { sel: '[data-welcome-screen] a[href]', label: "the welcome screen's sign-in link" },
    ],
  })
  for (const h of firstHits) {
    if (!h.found) { aSkip(`hit ${tag} · ${h.label}`, 'not in the DOM'); continue }
    aCheck(`hit ${tag} · ${h.label} (${h.size})`, h.ok, `elementFromPoint landed on ${h.blockedBy}`)
  }

  // ── Contrast, the picker with a list open, plus the option row's hit-test ──
  await guarded(`the open-list group ${tag}`, async () => {
    await typeInto(page, HERO_PICKER, PLACE_QUERY)
    const open = await page.evaluate(auditProbe, {
      items: [
        { sel: `${HERO_PICKER} [role="option"]`, what: "an option row's label" },
        { sel: `${HERO_PICKER} [role="option"] svg`, what: "an option row's pin", icon: true },
      ],
      big: true,
    })
    for (const r of open) {
      if (!r.found) { aSkip(`contrast ${tag} · ${r.what}`, `no visible element matched ${r.sel}`); continue }
      aCheck(`contrast ${tag} · ${r.what} — ${r.ratio}:1 (needs ${r.need})`, r.ratio >= r.need, `"${r.raw}"`)
    }
    const rowHit = await page.evaluate(auditHit, {
      sels: [{ sel: `${HERO_PICKER} [role="option"]`, label: 'the first option row' }],
    })
    for (const h of rowHit) {
      if (!h.found) { aSkip(`hit ${tag} · ${h.label}`, 'not in the DOM'); continue }
      aCheck(`hit ${tag} · ${h.label} (${h.size})`, h.ok, `elementFromPoint landed on ${h.blockedBy}`)
    }
  })

  // ── The honest line ──
  await guarded(`the no-results group ${tag}`, async () => {
    await typeInto(page, HERO_PICKER, NO_MATCH, { expectOptions: false })
    await page.waitForSelector(PROBLEM, { timeout: 15000 })
    const honest = await page.evaluate(auditProbe, { items: [{ sel: PROBLEM, what: 'the "nothing matched" line' }], big: true })
    for (const r of honest) {
      if (!r.found) { aSkip(`contrast ${tag} · ${r.what}`, 'not rendered'); continue }
      aCheck(`contrast ${tag} · ${r.what} — ${r.ratio}:1 (needs ${r.need})`, r.ratio >= r.need, `"${r.raw}" · "${r.text}"`)
    }
  })

  await ctx.close()
}

/**
 * The place on screen: the strip, the notice on each surface, and the honest
 * conversations state. Signed out, so the notice reason is `signed-out`.
 */
async function auditPlace(theme, vp, tag) {
  const { ctx, page } = await freshContext(theme, vp)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(WELCOME, { timeout: 25000 })
  await page.waitForTimeout(2000)
  await typeInto(page, HERO_PICKER, PLACE_QUERY)
  await page.locator(`${HERO_PICKER} [role="option"]`).first().click()
  if ((await settle(page)) !== 'shell') throw new Error(`audit ${tag}: the place never resolved`)
  await page.waitForTimeout(2500)
  await assertTheme(page, theme, `audit place ${tag}`)

  await goToView(page, 'explore')
  const explore = await page.evaluate(auditProbe, {
    items: [
      { sel: `${STRIP} [aria-live] strong`, what: "the strip's place name" },
      { sel: LEAVE, what: "the strip's leave control" },
      { sel: `${STRIP} button[aria-expanded]`, what: "the strip's change control" },
      { sel: `${STRIP} svg`, what: "the strip's pin", icon: true },
      { sel: '[data-read-only-notice] p', what: 'the read-only notice (explore)' },
      { sel: '[data-read-only-notice] svg', what: "the notice's eye icon", icon: true },
    ],
    big: true,
  })
  for (const r of explore) {
    if (!r.found) { aSkip(`contrast ${tag} · ${r.what}`, `no visible element matched ${r.sel}`); continue }
    aCheck(`contrast ${tag} · ${r.what} — ${r.ratio}:1 (needs ${r.need})`, r.ratio >= r.need, `"${r.raw}" · "${r.text}"`)
  }

  const hits = await page.evaluate(auditHit, {
    sels: [
      { sel: `${STRIP} button[aria-expanded]`, label: "the strip's Change control" },
      { sel: LEAVE, label: "the strip's leave control" },
      { sel: '[data-read-only-notice] a, [data-read-only-notice] button', label: "the notice's own control (signed-out)" },
    ],
  })
  for (const h of hits) {
    if (!h.found) { aSkip(`hit ${tag} · ${h.label}`, 'not in the DOM'); continue }
    aCheck(`hit ${tag} · ${h.label} (${h.size})`, h.ok, `elementFromPoint landed on ${h.blockedBy}`)
  }

  // The compact picker, which only exists once the strip is expanded — and is
  // the SAME component as the hero one, so a layering bug here is its own.
  await page.locator(`${STRIP} button[aria-expanded]`).first().click()
  await page.waitForTimeout(600)
  const compactHit = await page.evaluate(auditHit, {
    sels: [{ sel: '[data-place-picker="compact"] input[role="combobox"]', label: "the strip's compact picker input" }],
  })
  for (const h of compactHit) {
    if (!h.found) { aSkip(`hit ${tag} · ${h.label}`, 'not in the DOM'); continue }
    aCheck(`hit ${tag} · ${h.label} (${h.size})`, h.ok, `elementFromPoint landed on ${h.blockedBy}`)
  }
  await page.keyboard.press('Escape')
  await page.locator(`${STRIP} button[aria-expanded]`).first().click()
  await page.waitForTimeout(400)

  // The honest conversations state.
  await goToView(page, 'conversations')
  const convo = await page.evaluate(auditProbe, {
    items: [
      { sel: `${FEED_PANEL} h3`, what: 'the honest conversations heading' },
      { sel: `${FEED_PANEL} h3 + p`, what: 'the honest conversations body' },
    ],
    big: true,
  })
  for (const r of convo) {
    if (!r.found) { aSkip(`contrast ${tag} · ${r.what}`, `no visible element matched ${r.sel}`); continue }
    aCheck(`contrast ${tag} · ${r.what} — ${r.ratio}:1 (needs ${r.need})`, r.ratio >= r.need, `"${r.raw}" · "${r.text}"`)
  }

  await ctx.close()
}

/**
 * 🔴 The notice renders a DIFFERENT control per reason, so the hit-test has to
 * run per reason and not once. `other-place` and `no-slice` are only reachable
 * with a session, so they get their own walk.
 */
async function auditMemberNotices(theme, vp, tag) {
  const { ctx, page } = await freshContext(theme, vp)
  await page.addInitScript(() => { try { localStorage.setItem('cs_active_tab', 'city') } catch { /* guarded */ } })
  await page.goto(`${ORIGIN}/?dev=1&place=bloomington`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(STRIP, { timeout: 25000 })
  await page.waitForTimeout(3000)
  await assertTheme(page, theme, `audit member ${tag}`)

  // 🔴 The officials read line 2 of the verification bar needs a HUMAN for.
  // Printed, never asserted: no script can tell one real person's name from
  // another's, so this is here to put the three rosters side by side.
  const own = await page.evaluate(auditRoster)

  await page.locator(`${STRIP} button[aria-expanded]`).first().click()
  await page.waitForTimeout(500)
  await typeInto(page, '[data-place-picker="compact"]', PLACE_QUERY)
  await page.locator('[data-place-picker="compact"] [role="option"]').first().click()
  await page.waitForTimeout(3000)
  await goToView(page, 'explore')

  const visitedCity = await page.evaluate(auditRoster)
  const notice = await page.evaluate(auditProbe, {
    items: [{ sel: '[data-read-only-notice] p', what: 'the other-place notice' }],
    big: true,
  })
  for (const r of notice) {
    if (!r.found) { aSkip(`contrast ${tag} · ${r.what}`, 'not rendered'); continue }
    aCheck(`contrast ${tag} · ${r.what} — ${r.ratio}:1 (needs ${r.need})`, r.ratio >= r.need, `"${r.raw}" · "${r.text}"`)
  }
  const hit = await page.evaluate(auditHit, {
    sels: [{ sel: '[data-read-only-notice] button, [data-read-only-notice] a', label: "the other-place notice's way out" }],
  })
  for (const h of hit) {
    if (!h.found) { aSkip(`hit ${tag} · ${h.label}`, 'not in the DOM'); continue }
    aCheck(`hit ${tag} · ${h.label} (${h.size})`, h.ok, `elementFromPoint landed on ${h.blockedBy}`)
  }

  /**
   * 🔴 The roster read is DESKTOP ONLY, and says so rather than reporting an
   * absence. Below `md` the right column is hidden and `SidebarMobile` takes
   * over as a COLLAPSED disclosure, so the officials are on the page and not in
   * `innerText` — printing "(no roster widget)" for that would read as a
   * finding about the officials when it is a fact about a closed `<details>`.
   */
  if (vp.width < 768) {
    aSkip(`officials ${tag}`, 'below md the roster lives inside the COLLAPSED SidebarMobile disclosure — read it at 1440')
  }

  // Federal, at the same place, then back to the member's own spaces.
  const fedSel = vp.width >= 1024 ? `${RAIL_SEL} [data-nav-tab="federal"]` : `${TABBAR_SEL} [data-slice-tab="federal"]`
  await page.locator(fedSel).first().click()
  await page.waitForTimeout(2500)
  const visitedFederal = await page.evaluate(auditRoster)
  await page.locator(LEAVE).first().click()
  await page.waitForTimeout(3000)
  const backHome = await page.evaluate(auditRoster)

  if (vp.width >= 768) rosters.push({ tag, own, visitedCity, visitedFederal, backHome })

  await ctx.close()
}

/**
 * 🔴 Step 3: nothing on the welcome screen or in the picker may animate under
 * `prefers-reduced-motion: reduce`.
 *
 * `motion` at this version does not DECLARE `useReducedMotion` in its types, so
 * a guarded entrance would not typecheck — `SeedInvitationModule` records that
 * finding and chose no animation at all, and `PlacePicker` made the same call.
 * So the guard here is CSS: everything that moves is behind Tailwind's
 * `motion-safe:`, which compiles to `@media (prefers-reduced-motion: no-preference)`.
 */
async function auditReducedMotion(theme, vp, tag) {
  const { ctx, page } = await freshContext(theme, vp, { reducedMotion: true })
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(WELCOME, { timeout: 25000 })
  await page.waitForTimeout(2200)
  await typeInto(page, HERO_PICKER, PLACE_QUERY)
  const m = await page.evaluate(auditMotion)
  aCheck(`reduced-motion ${tag} · the page SEES the preference`, m.matched,
    'matchMedia did not match — the rest of this group would be vacuous')
  if (!m.matched) {
    aSkip(`reduced-motion ${tag} · nothing animates`, 'the preference never reached the page')
  } else {
    aCheck(`reduced-motion ${tag} · no running animation on the welcome screen or the picker`,
      m.running.length === 0, `running: ${m.running.join(', ')}`)
    aCheck(`reduced-motion ${tag} · no element under them declares a non-zero transition or animation`,
      m.moving.length === 0, `still moving: ${m.moving.join(', ')}`)
  }
  await ctx.close()
}

async function runAudit() {
  console.log('── AUDIT: CONTRAST THROUGH A CANVAS, HIT-TESTS, REDUCED MOTION ──\n')
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const tag = `${theme}-${vp.width}`
      console.log(`── ${theme.toUpperCase()} · ${vp.width} ${'─'.repeat(40)}`)
      // Every walk is guarded for the reason on `guarded`: a group that cannot
      // run has to produce a FAIL line naming itself, not a stack trace that
      // takes the other three walks with it.
      await guarded(`the welcome walk ${tag}`, () => auditWelcome(theme, vp, tag))
      await guarded(`the visited-place walk ${tag}`, () => auditPlace(theme, vp, tag))
      await guarded(`the member walk ${tag}`, () => auditMemberNotices(theme, vp, tag))
      await guarded(`the reduced-motion walk ${tag}`, () => auditReducedMotion(theme, vp, tag))
      console.log('')
    }
  }

  console.log('── THE OFFICIALS READ — PRINTED FOR A HUMAN, NEVER ASSERTED ─────')
  console.log('   No script can tell one real person\'s name from another\'s. Read these.\n')
  for (const r of rosters) {
    console.log(`  ${r.tag}`)
    console.log(`    own spaces (Bloomington, IN)  ${r.own.present ? r.own.text.slice(0, 300) : '(no roster widget)'}`)
    console.log(`    visiting Asheville · City     ${r.visitedCity.present ? r.visitedCity.text.slice(0, 300) : '(no roster widget)'}`)
    console.log(`    visiting Asheville · Federal  ${r.visitedFederal.present ? r.visitedFederal.text.slice(0, 300) : '(no roster widget)'}`)
    console.log(`    back on own spaces            ${r.backHome.present ? r.backHome.text.slice(0, 300) : '(no roster widget)'}`)
    console.log('')
  }

  console.log(`  ${auditPass} PASS, ${auditFail} FAIL, ${auditSkips.length} SKIP`)
  for (const s of auditSkips) console.log(`    SKIP ${s}`)
  console.log('')
}

// ── Run ──────────────────────────────────────────────────────────────────────

console.log(`\nshoot-welcome — ${ORIGIN} → ${OUT}/`)
if (WANT_SHOTS) {
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
}

if (WANT_AUDIT) await runAudit()

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

if (errors.page.length || errors.console.length || auditFail > 0) process.exit(1)
