#!/usr/bin/env node
/**
 * check-place-entry.mjs — a place arrives, and nothing about it is kept or sent.
 *
 * Run: npm run dev, then npm run check:place-entry [-- --port 5173]
 * No credential: it drives `?signedout=1` (dev-only, clears cs_token for the
 * life of the page) and `?dev=1&place=bloomington` (the reserved dev-guest id).
 *
 * 🔴 ITS OWN SCRIPT, and that is not a contradiction of "extend, never fork".
 * `17-SHARED.md` says extend rather than fork FOR THE SAME SUBJECT.
 * `check-explore-gate.mjs`'s subject is *"no write is offered"*; this one's is
 * *"a place arrives, and nothing about it is kept or sent"*. Different failure
 * messages, different things to read when one goes red. 17-06 extends that one
 * for the write question, not this one.
 *
 * ── 🔴 Almost every assertion here is about an ABSENCE ───────────────────────
 *
 * Nothing stored, nothing echoed, no request, no control. All of those are true
 * of a page where the place never arrived — so every run states its CONTROL CASE
 * first and stops if it fails, and the network assertion carries a POSITIVE half
 * (requests were made; `coordinate-lookup` fired exactly once) beside the
 * negative one. 17-VALIDATION.md's vacuous-pass table is the list this is
 * written against.
 *
 * ── The fixtures, and how they go stale ─────────────────────────────────────
 *
 * The two place legs are served by Playwright route interception from the
 * committed fixtures in `scripts/fixtures/`, so this check is deterministic and
 * offline and goes red on OUR behaviour rather than on a ranking change at
 * ev-accounts.
 *
 * 🔴 They are a contract snapshot and they go stale SILENTLY. The thing that
 * notices is:
 *
 *     node scripts/check-place-resolve.mjs --live
 *
 * which compares each fixture's shape — and, for `place-search-buncombe.json`,
 * the ORDER of its first row — against the real endpoint and exits non-zero on
 * drift. If this check is green and the app is broken against the live API, that
 * is the command to run.
 *
 * 🔴 No fixture branch was added to the APP to make this testable. A
 * `?placefixture=1` path would be fake data shipped to production to serve a
 * test, and `CLAUDE.md` is explicit that invented data does not go in
 * components. The check stubs the network; the app keeps one data path.
 *
 * ── Playwright, and the theme ────────────────────────────────────────────────
 *
 * 🔴 Playwright is a GLOBAL install here, not a dependency — `node_modules` is
 * the wrong place to look. `loadChromium` below is copied from
 * `check-explore-gate.mjs` rather than re-derived, including the
 * `mod.chromium ?? mod.default?.chromium` read: the global package's export
 * shape differs between its CJS and ESM entry points.
 *
 * 🔴 Playwright's `colorScheme` context option does NOTHING in this app. Dark is
 * class-based and is set before first paint from the `ev_theme` cookie,
 * never from `prefers-color-scheme`. The cookie is set on the CONTEXT and
 * `documentElement.classList` is ASSERTED to match, every time — asking for
 * light and silently rendering dark is how a four-way run becomes a two-way one.
 */

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = arg('--port', '5173')
const ORIGIN = `http://localhost:${PORT}`

// ── Selectors ────────────────────────────────────────────────────────────────

const WELCOME = '[data-welcome-screen]'
const PICKER = '[data-place-picker]'
const STRIP = '[data-place-strip]'
const LEAVE = '[data-place-strip-leave]'
const PANEL = '#forum-view-explore'
const FEED_PANEL = '#forum-view-conversations'
const RAIL = 'nav[aria-label="Civic space navigation"]'
const TABBAR = 'nav[aria-label="Slice tabs"]'

/**
 * The two controls assertion 14 is about, and why each is identified this way.
 *
 * 🔴 `aria-haspopup="listbox"` is `SliceSelector`'s trigger and nothing else's —
 * `PlaceStrip`'s disclosure deliberately uses `aria-expanded` alone so these two
 * can never be confused (see PlaceStrip.tsx). `FeedSearch`'s `aria-label` is its
 * accessible name and is the only one in the app.
 */
const SHARD_SWITCHER = 'button[aria-haspopup="listbox"]'
const FEED_SEARCH = 'input[aria-label="Search this feed"]'

// ── The place, and the tracer ────────────────────────────────────────────────

const PLACE_NAME = 'Asheville'

/**
 * 🔴 What the D-13 assertions actually look for, and it is deliberately NOT
 * "asheville".
 *
 * After a successful lookup the page is COVERED in the word Asheville — the
 * banner, the rail, the About widget, every Explore module — all of it resolved
 * FROM THE GEOID through `geoNames.ts`, which is the whole point of D-13 and not
 * an echo of anything. Searching the page for the place's name would therefore
 * fail on correct behaviour. A token nobody could render for any other reason is
 * the only thing a browser can honestly ask about.
 */
const TRACER = 'zqxwvu-tracer-7731'

/** The query the no-results fixture answers. Anything else gets a real place. */
const NO_MATCH = 'zzzqqqxnotaplace'

/** A county-level choice: the unincorporated case, FOUR tabs and no City. */
const COUNTY_QUERY = 'buncombe'

/**
 * The visited place's geoids, as VALUES.
 *
 * 🔴 Compared as whole query-parameter values (after stripping PostgREST's
 * `eq.` / `in.` operator prefix), never as substrings of the URL. A bare
 * substring search for the state geoid `37` matches a third of all UUIDs and
 * would report a finding on every run; dropping `37` to avoid that would let the
 * one request keyed on a visited STATE through. Exact values give both.
 *
 * `US` and `UNIFIED` are safe to include here because the dev fixture's own
 * federal and unified geoids are `3711` and `''` — in production a member's own
 * federal slice IS `US`, and a future run against a real session should drop
 * those two rather than widen the allowlist.
 */
const VISITED_VALUES = new Set(['3702140', '37021', '37', 'US', 'UNIFIED'])

/** The five keys of `ResolvedPlace`, which is all `cs_viewed_place` may carry. */
const PLACE_KEYS = ['city', 'county', 'nation', 'state', 'unified']

/**
 * Console noise the dev fixtures produce by design. CLAUDE.md records that
 * member-only APIs 401 for the dev id and that the accounts session endpoint
 * sends no CORS header for localhost. The suppressed lines are PRINTED, so this
 * allowlist cannot quietly become a place a real error hides.
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

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const reds = []

function check(run, id, label, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`  PASS ${String(id).padStart(6)}  ${label}`)
  } else {
    failed += 1
    reds.push(`${run} #${id}`)
    console.log(`  FAIL ${String(id).padStart(6)}  ${label}${detail === undefined ? '' : `\n              ${detail}`}`)
  }
}

function skip(id, why) {
  console.log(`  SKIP ${String(id).padStart(6)}  ${why}`)
}

const DESKTOP = { width: 1440, height: 1000 }
const MOBILE = { width: 390, height: 844 }

// ── Page-side readers (one serialisable argument each) ───────────────────────

/** Every key and value of both storages, flattened — the D-13 sweep's input. */
function dumpStorage() {
  const grab = (store) => {
    const out = []
    try {
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i)
        out.push([k, store.getItem(k) ?? ''])
      }
    } catch {
      out.push(['(blocked)', ''])
    }
    return out
  }
  let session = []
  let local = []
  try { session = grab(window.sessionStorage) } catch { session = [['(blocked)', '']] }
  try { local = grab(window.localStorage) } catch { local = [['(blocked)', '']] }
  let viewed = null
  try { viewed = window.sessionStorage.getItem('cs_viewed_place') } catch { viewed = null }
  return { session, local, viewed }
}

/** What is on screen for the place: the banner's name, the tabs, the modules. */
function readPlace({ panel, rail, bar }) {
  const railTabs = [...document.querySelectorAll(`${rail} [data-nav-tab]`)].map((b) => b.dataset.navTab)
  const barTabs = [...document.querySelectorAll(`${bar} [data-slice-tab]`)].map((b) => b.dataset.sliceTab)
  const p = document.querySelector(panel)
  return {
    hero: document.querySelector('h2')?.innerText?.trim() ?? null,
    strip: document.querySelector('[data-place-strip]')?.getAttribute('data-place-strip') ?? null,
    stripText: (document.querySelector('[data-place-strip]')?.innerText || '').replace(/\s+/g, ' ').trim(),
    welcome: !!document.querySelector('[data-welcome-screen]'),
    railTabs,
    barTabs,
    modules: p && p.offsetParent !== null ? [...p.querySelectorAll('[data-explore-module]')].map((d) => d.dataset.exploreModule) : null,
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' '),
  }
}

/** The Conversations surface for a visited place: no posts, and no way to write. */
function readConversations({ sel }) {
  const p = document.querySelector(sel)
  if (!p) return { panel: false }
  if (p.offsetParent === null) return { panel: true, visible: false }
  const text = p.innerText || ''
  return {
    panel: true,
    visible: true,
    postCards: p.querySelectorAll('article').length,
    textareas: p.querySelectorAll('textarea').length,
    submits: p.querySelectorAll('button[type="submit"]').length,
    // The phone FAB and the desktop Post button, the two composer entry points.
    fabs: document.querySelectorAll('button[aria-label="Create new post"]').length,
    postButtons: [...document.querySelectorAll('button')].filter(
      (b) => b.offsetParent !== null && (b.textContent || '').trim() === 'Post',
    ).length,
    honest: /Conversations here belong to the people who live here/.test(text),
    notice: p.querySelector('[data-read-only-notice]')?.getAttribute('data-read-only-notice') ?? null,
  }
}

/** The two slice-scoped controls, and the member counts the below-lg bar renders. */
function readSliceScoped({ shard, search, bar }) {
  const visible = (el) => !!el && el.offsetParent !== null
  const barEl = document.querySelector(bar)
  return {
    shardSwitchers: [...document.querySelectorAll(shard)].filter(visible).length,
    feedSearches: [...document.querySelectorAll(search)].filter(visible).length,
    barPresent: visible(barEl),
    barMemberCounts: barEl
      ? [...barEl.querySelectorAll('[data-slice-tab]')]
          .map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim())
          .filter((t) => /\d[\d,]*\s+members?$/.test(t))
      : [],
  }
}

/** elementFromPoint at a control's centre: does a click actually land on it? */
function hitTest({ selector }) {
  const el = document.querySelector(selector)
  if (!el) return { found: false }
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return { found: true, ok: false, why: 'zero-size box' }
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  if (cy < 0 || cy > window.innerHeight) return { found: true, ok: false, why: `off-screen (top ${Math.round(r.top)})` }
  const at = document.elementFromPoint(cx, cy)
  return {
    found: true,
    ok: !!at && (at === el || el.contains(at)),
    blockedBy: at ? `${at.tagName.toLowerCase()}.${String(at.className || '').split(' ')[0]}` : 'nothing',
  }
}

/**
 * The same test, over EVERY element the selector matches.
 *
 * 🔴 `hitTest` reads `querySelector` — the FIRST match — and for a listbox that
 * is the one row least likely to be covered. The picker's dropdown shipped at
 * `z-20` under a `z-30` sticky bar, which swallowed clicks on the MIDDLE row at
 * both viewports while row 0 stayed reachable, so the single-element assertion
 * passed over a control that silently ignored clicks. A list is only usable if
 * every row in it is.
 *
 * Returns the per-row results plus the first failure, so the message names the
 * row and its blocker rather than just saying the list is wrong.
 */
function hitTestAll({ selector }) {
  const els = [...document.querySelectorAll(selector)]
  if (els.length === 0) return { found: false, n: 0 }
  const rows = els.map((el, i) => {
    const r = el.getBoundingClientRect()
    const label = (el.textContent || '').trim().slice(0, 28)
    if (r.width === 0 || r.height === 0) return { i, label, ok: false, why: 'zero-size box' }
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    if (cy < 0 || cy > window.innerHeight) {
      return { i, label, ok: false, why: `off-screen (top ${Math.round(r.top)})` }
    }
    const at = document.elementFromPoint(cx, cy)
    return {
      i,
      label,
      ok: !!at && (at === el || el.contains(at)),
      blockedBy: at ? `${at.tagName.toLowerCase()}.${String(at.className || '').split(' ')[0]}` : 'nothing',
    }
  })
  const bad = rows.filter((r) => !r.ok)
  return { found: true, n: rows.length, ok: bad.length === 0, bad, rows }
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
    buncombe: (await load('place-search-buncombe.json')).rows,
    none: (await load('place-search-no-results.json')).rows,
    coordinates: (await load('coordinate-lookup-asheville.json')).body,
  }
}

/**
 * Serve the two place legs, keyed on the typed query.
 *
 * Only these two. Banners, meetings, elections and Compass topics reach the
 * network exactly as they do for a real visitor; what is pinned is the
 * RESOLUTION, which is what decides whether the run is about a place at all.
 */
async function stubPlaceLegs(page, fx, counters) {
  await page.route('**/api/essentials/location-search*', (route) => {
    counters.search += 1
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase()
    const rows = q.includes(NO_MATCH) ? fx.none : q.includes(COUNTY_QUERY) ? fx.buncombe : fx.asheville
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await page.route('**/api/essentials/coordinate-lookup', (route) => {
    counters.coordinate += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx.coordinates) })
  })
}

// ── The run ──────────────────────────────────────────────────────────────────

const chromium = await loadChromium()
if (!chromium) {
  console.error('Playwright not found locally or globally. It is a GLOBAL install here —')
  console.error('node_modules is the wrong place to look. See CLAUDE.md.')
  process.exit(1)
}

const fx = await readFixtures()
const browser = await chromium.launch()

/** Everything one context needs: the theme cookie, the stubs, the error traps, the request log. */
async function freshContext(theme, viewport, init) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addCookies([{ name: 'ev_theme', value: theme, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()
  const errors = { page: [], console: [], noise: [] }
  page.on('pageerror', (e) => errors.page.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    ;(EXPECTED_NOISE.some((re) => re.test(t)) ? errors.noise : errors.console).push(t)
  })
  const counters = { search: 0, coordinate: 0 }
  /**
   * 🔴 The BODY is recorded, not only the URL, and that is not belt-and-braces.
   *
   * The conversations feed is `supabase.rpc('get_boosted_feed_filtered', …)` —
   * a POST to `/rest/v1/rpc/…` whose slice id travels in the JSON body. A
   * network assertion that read query parameters alone could not see the single
   * most important request in this phase, and the revert matrix proved it: with
   * the conversations guard removed and feed panels mounted on the visited
   * place, assertion 3 went red and the network assertion stayed green.
   */
  const requests = { recording: false, seen: [] }
  page.on('request', (r) => {
    if (requests.recording) requests.seen.push({ url: r.url(), body: r.postData() ?? null })
  })
  if (init) await page.addInitScript(init)
  await stubPlaceLegs(page, fx, counters)
  return { ctx, page, errors, counters, requests }
}

/** Waits for the app and CONFIRMS the theme it chose. Never assumes it. */
async function bootedWithTheme(page, theme, ready) {
  await page.waitForSelector(ready, { timeout: 25000 })
  await page.waitForTimeout(2000)
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  return isDark === (theme === 'dark')
}

/**
 * 🔴 THERE IS NO "clean the profile" INIT SCRIPT HERE, and that is a correction
 * rather than an omission.
 *
 * A fresh Playwright context already has empty storage, so clearing it buys
 * nothing — and `page.addInitScript` runs before EVERY document load, reloads
 * and in-context navigations included. A cleaner registered that way therefore
 * deletes `cs_viewed_place` on the way into the very navigations this check
 * exists to make assertions about. It cost two findings in one run before it was
 * caught: the reload assertion went red for the check's own doing, and — far
 * worse — the deep-link assertion went GREEN because the init script had removed
 * the place a moment before `openPost` was asked to. A vacuous pass, in the
 * check written to catch vacuous passes.
 *
 * Anything a run genuinely needs planted before first paint is planted by that
 * run, and is written to be harmless when it runs again.
 */

/**
 * Type into a picker input, from empty, and wait for the list to answer.
 *
 * 🔴 The fixed wait is not padding. `usePlaceSearch` debounces at 250 ms, and
 * the stub answers EVERY query with the same rows — so a run that only waited
 * for `[role="option"]` would be satisfied by the PREVIOUS query's list, click
 * through it, and never make the second request at all. That silently turned the
 * network assertion's "location-search fired more than once" into a statement
 * about one keystroke.
 */
async function typeInto(page, scope, text, { expectOptions = true } = {}) {
  const input = page.locator(`${scope} input[role="combobox"]`)
  await input.click()
  await input.fill('')
  await input.fill(text)
  await page.waitForTimeout(900)
  if (expectOptions) await page.waitForSelector(`${scope} [role="option"]`, { timeout: 10000 })
  else await page.waitForTimeout(600)
}

/**
 * Wait for the app to settle on ONE of its two signed-out states and say which.
 *
 * 🔴 Never a bare `waitForSelector(PANEL)`. An unguarded wait throws on a
 * timeout and takes the whole run with it — and a crashed run tells you less
 * than a failed one, which is the lesson 17-02's own revert matrix left behind
 * in `check-explore-gate.mjs`.
 */
async function settle(page, timeout = 20000) {
  const deadline = Date.now() + timeout
  let last = 'neither'
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
    // 🔴 Only `shell` ends the wait. The welcome screen is the state the app is
    // ALREADY in while a place resolves, so returning on the first sight of it
    // would report "never left the welcome screen" about every successful run —
    // a race that reads exactly like the failure it is supposed to detect.
    if (state === 'shell') return 'shell'
    last = state
    await page.waitForTimeout(400)
  }
  return last
}

/** Switch tabs at ANY width: the rail from lg up, the tab bar below it. */
async function goToTab(page, key) {
  const vp = page.viewportSize()
  const sel = vp && vp.width >= 1024 ? `${RAIL} [data-nav-tab="${key}"]` : `${TABBAR} [data-slice-tab="${key}"]`
  await page.locator(sel).first().click()
  await page.waitForTimeout(900)
}

async function goToView(page, view) {
  await page.getByRole('tab', { name: view === 'explore' ? /Explore/i : /Conversations/i }).click()
  await page.waitForTimeout(900)
}

/**
 * The network assertion's reader.
 *
 * 🔴 PostgREST only. Everything else on the page — banners, meetings, elections,
 * the by-area officials 17-06 adds — is an ANONYMOUS, by-area endpoint and is
 * SUPPOSED to carry the visited geoid: that is the place's own data. The
 * database is the thing a visited place must never reach, because in Phase 17
 * every `civic_spaces` grant is `TO authenticated` and
 * `posts_select_sibling_slice` joins on geoid — so such a request returns zero
 * rows rather than an error, and zero rows renders as "nobody has said anything
 * here", which is a lie told silently.
 */
/** Is this one string a visited geoid, or the place sentinel? */
function offending(value) {
  if (typeof value !== 'string') return null
  if (value.includes('place:')) return 'place sentinel'
  // PostgREST filters arrive as `eq.3702140`, `in.(a,b)`, `like.*x*`. Compared as
  // whole values, never as substrings of the URL: a substring search for the
  // state geoid `37` matches a third of all UUIDs.
  const bare = value.replace(/^[a-z]+\.\(?/, '').replace(/\)$/, '')
  for (const part of bare.split(',')) {
    if (VISITED_VALUES.has(part)) return 'visited geoid'
  }
  return null
}

/** Every string inside a parsed JSON body, however nested. */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

function postgrestHits(seen) {
  const hits = []
  for (const { url: raw, body } of seen) {
    if (!raw.includes('/rest/v1/')) continue
    let url
    try { url = new URL(raw) } catch { continue }
    for (const [key, value] of url.searchParams) {
      const why = offending(value)
      if (why) hits.push(`${url.pathname}?${key}=${value} (${why})`)
    }
    if (!body) continue
    // 🔴 The RPC path. `get_boosted_feed_filtered` is a POST whose slice id is in
    // the JSON body, so the whole conversations feed is invisible to the query
    // string above. Parsed where it parses, searched as text where it does not.
    let parsed = null
    try { parsed = JSON.parse(body) } catch { parsed = null }
    const values = parsed === null ? [body] : strings(parsed)
    for (const value of values) {
      const why = offending(value)
      if (why) hits.push(`POST ${url.pathname} body ${JSON.stringify(value).slice(0, 60)} (${why})`)
    }
  }
  return hits
}

/** Walk both views on both a city-level tab and Federal, confirming each landed. */
async function traverse(page, cityTab) {
  const seen = []
  for (const tab of [cityTab, 'federal']) {
    await goToTab(page, tab)
    for (const view of ['explore', 'conversations']) {
      await goToView(page, view)
      const vis = await page.evaluate(
        ({ p, f }) => ({
          explore: document.querySelector(p)?.offsetParent !== null,
          conversations: document.querySelector(f)?.offsetParent !== null,
        }),
        { p: PANEL, f: FEED_PANEL },
      )
      seen.push(`${tab}/${view}:${view === 'explore' ? vis.explore : vis.conversations}`)
    }
  }
  return seen
}

// ═════════════════════════════════════════════════════════════════════════════
// RUN A — signed out: the welcome screen, a place named, and everything after
// ═════════════════════════════════════════════════════════════════════════════

async function runSignedOutWalk() {
  const run = 'signed-out'
  console.log(`\n── SIGNED OUT: THE WELCOME SCREEN AND A NAMED PLACE ${'─'.repeat(14)}`)

  const { ctx, page, errors, counters, requests } = await freshContext('dark', DESKTOP)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark', WELCOME))) {
    check(run, 1, 'the page booted with the requested theme and the welcome screen mounted', false,
      'documentElement.dark does not match the cookie, or the welcome screen never rendered.')
    await ctx.close()
    return { errors, done: false }
  }

  const pickerBefore = await page.locator(`${PICKER} input[role="combobox"]`).count()

  // 🔴 Record from the moment the place is chosen — and from BEFORE it, so the
  // resolution legs themselves are in the log and the positive half is real.
  requests.recording = true

  // 🔴 THE TRACER IS TYPED SECOND, AND IS THE QUERY IN THE BOX WHEN THE ROW IS
  // CHOSEN. The order matters and the first draft had it backwards.
  //
  // Typed first and replaced by "asheville", the tracer is not what the picker
  // is holding at the moment of choice — so a picker that stored or echoed
  // "what they typed" would store "asheville", and the D-13 assertions, which
  // can only look for the tracer, would stay green through exactly the change
  // they exist to catch. The revert matrix caught that: row 1 — the one row the
  // plan says to run slowly — turned nothing red.
  //
  // This way round the tracer IS the typed string at choose-time, and the two
  // distinct queries still make "location-search fired more than once" a
  // statement about typing rather than about one keystroke. The stub answers
  // every query with the Asheville rows, so the tracer resolves a real place.
  await typeInto(page, PICKER, PLACE_NAME.toLowerCase())
  await typeInto(page, PICKER, TRACER)
  const options = await page.locator(`${PICKER} [role="option"]`).count()
  await page.locator(`${PICKER} [role="option"]`).first().click()
  const settledOn = await settle(page)
  await page.waitForTimeout(2500)

  const landed = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })

  // ── 1  CONTROL CASE ───────────────────────────────────────────────────────
  const controlOk =
    pickerBefore === 1 &&
    options > 0 &&
    settledOn === 'shell' &&
    landed.hero === PLACE_NAME &&
    Array.isArray(landed.modules) &&
    landed.modules.length > 0 &&
    landed.railTabs.join(',') === 'city,county,state,federal,unified'
  check(
    run, 1,
    `CONTROL CASE — the picker was reachable, "${PLACE_NAME.toLowerCase()}" resolved to a banner reading ` +
      `"${landed.hero}", Explore rendered [${(landed.modules ?? []).join(', ') || 'NOTHING'}], and the tabs are ` +
      `[${landed.railTabs.join(', ')}]`,
    controlOk,
    `pickerInputs=${pickerBefore} options=${options} settledOn=${settledOn} ${JSON.stringify({ hero: landed.hero, railTabs: landed.railTabs })}` +
      '\n              🔴 EVERY assertion below is about an ABSENCE and is vacuously true of a page' +
      '\n              where the place never arrived. Stop here. Look at the two route stubs first:' +
      '\n              a chosen place row answers city and state, and resolveChosenPlace throws' +
      '\n              `no-county` without the coordinate-lookup leg — which leaves the viewer on' +
      '\n              the welcome screen, with no textareas and no requests either.',
  )
  if (!controlOk) {
    skip('2-17', 'everything below — NOT CHECKED. All of it is true of a page without a place.')
    await ctx.close()
    return { errors, done: false }
  }

  // ── 2  The welcome screen stood down and the real shell is up ─────────────
  check(
    run, 2,
    'the welcome screen is gone and the real shell replaced it — no placeless Explore in between (D-09)',
    !landed.welcome && landed.strip === 'visiting',
    `welcome=${landed.welcome} strip=${JSON.stringify(landed.strip)} "${landed.stripText}"`,
  )

  // ── D13-1  Nothing stored ─────────────────────────────────────────────────
  //
  // 🔴 The whole of both storages, not just our key: a well-meaning future
  // change that "remembered what they typed so the box is not empty next time"
  // would put it under some other name.
  {
    const dump = await page.evaluate(dumpStorage)
    const haystack = [...dump.session, ...dump.local].map(([k, v]) => `${k}=${v}`).join('\n').toLowerCase()
    const needles = [
      TRACER.toLowerCase(),
      encodeURIComponent(TRACER).toLowerCase(),
      TRACER.replace(/\s+/g, '').toLowerCase(),
      TRACER.replace(/-/g, '').toLowerCase(),
    ]
    const found = needles.filter((n) => haystack.includes(n))
    let keys = null
    try { keys = Object.keys(JSON.parse(dump.viewed ?? 'null')).sort() } catch { keys = null }
    check(
      run, 'D13-1',
      '🔴 D-13: nothing the visitor typed is in localStorage or sessionStorage, and cs_viewed_place carries exactly the five geoid keys',
      found.length === 0 && keys !== null && keys.join(',') === PLACE_KEYS.join(','),
      `tracerFoundAs=${JSON.stringify(found)} storedKeys=${JSON.stringify(keys)} cs_viewed_place=${dump.viewed}` +
        '\n              🔴 Do not relax this. If the tracer is in storage, find what wrote it —' +
        '\n              there is no third explanation. If the key set is wrong, ResolvedPlace grew' +
        '\n              a field, and the one it would grow is a name.',
    )
  }

  // ── D13-2  Nothing echoed ─────────────────────────────────────────────────
  //
  // 🔴 The picker's own input is gone by now — it unmounted with the welcome
  // screen, and `choose()` clears the query on success besides — so this cannot
  // read the visitor's own typing back and call it a finding. Asserted rather
  // than assumed, below.
  {
    const body = landed.bodyText.toLowerCase()
    const inputValues = await page.evaluate(() =>
      [...document.querySelectorAll('input')].map((i) => i.value).filter(Boolean),
    )
    check(
      run, 'D13-2',
      '🔴 D-13: nothing the visitor typed is in the rendered text, and no input is still holding it',
      !body.includes(TRACER.toLowerCase()) && !inputValues.some((v) => v.toLowerCase().includes(TRACER.toLowerCase())),
      `tracerInBody=${body.includes(TRACER.toLowerCase())} inputValues=${JSON.stringify(inputValues)}` +
        '\n              The place NAME on screen is resolved from the geoid by geoNames.ts and is not' +
        '\n              an echo — which is exactly why this looks for a tracer and not for "Asheville".',
    )
  }

  // ── 3  Conversations: the honest state, and no feed ───────────────────────
  await goToView(page, 'conversations')
  {
    const conv = await page.evaluate(readConversations, { sel: FEED_PANEL })
    check(
      run, 3,
      'the Conversations view for a visited place says so honestly: zero post cards and zero composer affordances',
      conv.visible === true &&
        conv.postCards === 0 &&
        conv.textareas === 0 &&
        conv.submits === 0 &&
        conv.fabs === 0 &&
        conv.postButtons === 0 &&
        conv.honest === true,
      JSON.stringify(conv) +
        '\n              An empty feed here would be worse than this state, not better: in Phase 17 RLS' +
        '\n              answers a visited place with zero rows, and zero rows renders as "nobody has' +
        '\n              said anything here" — a false statement delivered silently.',
    )
  }

  // ── 14 + NET  The traversal: both views, a city tab and Federal ───────────
  //
  // 🔴 Both halves on the same walk, because they are two requirements about one
  // bug and only one of them is visible in a request log. 17-04 made
  // `useSiblingSlices` bail on a `place:` sentinel AND render-guarded the shard
  // switcher and the feed search; the bail silences the network whether or not
  // the control renders, so a reverted render guard is INVISIBLE to the network
  // assertion. Not querying and not offering are different things.
  {
    const sliceScoped = []
    for (const vp of [DESKTOP, MOBILE]) {
      await page.setViewportSize(vp)
      await page.waitForTimeout(500)
      for (const tab of ['city', 'federal']) {
        await goToTab(page, tab)
        for (const view of ['explore', 'conversations']) {
          await goToView(page, view)
          const r = await page.evaluate(readSliceScoped, { shard: SHARD_SWITCHER, search: FEED_SEARCH, bar: TABBAR })
          sliceScoped.push({ w: vp.width, tab, view, ...r })
        }
      }
    }
    await page.setViewportSize(DESKTOP)
    await page.waitForTimeout(400)

    const below = sliceScoped.filter((r) => r.w === MOBILE.width)
    check(
      run, 14,
      'no shard switcher and no feed search at a visited place — both views, City and Federal, at 1440 AND 390',
      sliceScoped.every((r) => r.shardSwitchers === 0 && r.feedSearches === 0) &&
        below.every((r) => r.barPresent && r.barMemberCounts.length === 0),
      JSON.stringify(sliceScoped) +
        '\n              🔴 The 390 rows are not decoration. Below lg the nav rail is a DRAWER and' +
        '\n              SliceTabBar carries navigation instead — the surface a desktop-only run never' +
        '\n              sees, and the one 17-04 found was a fifth place rendering slice-scoped state' +
        '\n              after a plan had named four. `barPresent` false there means this checked' +
        '\n              nothing; a member count there is "0 members" about a real jurisdiction.',
    )

    const hits = postgrestHits(requests.seen)
    const sawRequests = requests.seen.length
    check(
      run, 'NET',
      'nothing about the visited place reaches the database — and the page WAS doing something',
      hits.length === 0 && sawRequests > 0 && counters.search > 1 && counters.coordinate === 1,
      `postgrestHits=${JSON.stringify(hits.slice(0, 5))} requests=${sawRequests} ` +
        `location-search=${counters.search} coordinate-lookup=${counters.coordinate}` +
        '\n              🔴 The three numbers after the hits are the POSITIVE half, and without them' +
        '\n              "no PostgREST request" is also true of a page that never loaded.' +
        '\n              coordinate-lookup must be EXACTLY once: it is ~100 KB and ~1.2 s, and it must' +
        '\n              never be in the typeahead.' +
        '\n              A hit here is a hook wired to a visited place. Find the hook, not the' +
        '\n              assertion: in Phase 17 that request returns zero rows rather than an error.',
    )
  }

  // ── 10  Hit-tests: the picker, an option row, and the way out ─────────────
  //
  // PR #92 shipped a control that rendered perfectly and could not be clicked:
  // under a padded layer at the wrong z-index, at md and up only, so phones
  // looked fine and every screenshot passed. Rendering is not reachability.
  {
    const results = []
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => {
        document.cookie = `ev_theme=${t}; path=/; max-age=31536000; SameSite=Lax`
        document.documentElement.classList.toggle('dark', t === 'dark')
      }, theme)
      // 🔴 Asserted, not assumed. Playwright's colorScheme would have changed nothing.
      const classOk = await page.evaluate(
        (t) => document.documentElement.classList.contains('dark') === (t === 'dark'),
        theme,
      )
      for (const vp of [DESKTOP, MOBILE]) {
        await page.setViewportSize(vp)
        await page.waitForTimeout(400)
        await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), STRIP)
        await page.waitForTimeout(250)

        const leaveHit = await page.evaluate(hitTest, { selector: LEAVE })
        // Open the strip's own picker and reach its input and first row.
        await page.locator(`${STRIP} button[aria-expanded]`).first().click()
        await page.waitForTimeout(350)
        const inputHit = await page.evaluate(hitTest, { selector: `${STRIP} input[role="combobox"]` })
        await typeInto(page, STRIP, PLACE_NAME.toLowerCase())
        await page.evaluate((s) => document.querySelector(`${s} [role="option"]`)?.scrollIntoView({ block: 'center' }), STRIP)
        await page.waitForTimeout(250)
        // 🔴 EVERY row, not just the first — see hitTestAll. The first row was
        // reachable the whole time the middle one was not.
        const optionHit = await page.evaluate(hitTestAll, { selector: `${STRIP} [role="option"]` })
        // 🔴 Escape, never a click: choosing a row would resolve a second place
        // and the coordinate-lookup-exactly-once assertion above would be a lie.
        await page.keyboard.press('Escape')
        await page.locator(`${STRIP} button[aria-expanded]`).first().click()
        await page.waitForTimeout(300)

        results.push({ theme, w: vp.width, classOk, leave: leaveHit, input: inputHit, option: optionHit })
      }
    }
    await page.setViewportSize(DESKTOP)
    const ok = (h) => h.found && h.ok
    check(
      run, 10,
      'the picker input, EVERY option row and the leave control all hit-test to themselves — 2 themes x 2 viewports',
      results.every((r) => r.classOk && ok(r.leave) && ok(r.input) && r.option.found && r.option.ok),
      results
        .map((r) => {
          const o = r.option.found
            ? `${r.option.n} row(s), ${r.option.ok ? 'all reachable' : 'UNREACHABLE: ' + JSON.stringify(r.option.bad)}`
            : 'no rows found'
          return `${r.theme}/${r.w}px themeApplied=${r.classOk} leave=${JSON.stringify(r.leave)} input=${JSON.stringify(r.input)} options=${o}`
        })
        .join('\n              ') +
        '\n              🔴 A row that renders and cannot be clicked is invisible to every PNG and' +
        '\n              to tsc -b. The dropdown is z-[35] so it clears the z-30 sticky section bar;' +
        '\n              drop it back to z-20 and the MIDDLE row goes unreachable at both widths' +
        '\n              while the first stays fine — which is how this shipped.' +
        '\n              Fix the layering, then 🔴 toggle the suspect class off mid-run and re-test. A' +
        '\n              fix that is load-bearing puts the bug straight back; if removing it changes' +
        '\n              nothing, the real bug is still there.',
    )
  }

  // ── 4  The place survives a reload, and the welcome screen does not return ─
  await page.reload({ waitUntil: 'domcontentloaded' })
  const afterReload = await settle(page)
  await page.waitForTimeout(2500)
  {
    const after = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })
    check(
      run, 4,
      'the place survives a reload (sessionStorage, geoids only) and the welcome screen does not come back',
      afterReload === 'shell' && after.hero === PLACE_NAME && !after.welcome && after.strip === 'visiting',
      `settledOn=${afterReload} ` + JSON.stringify({ hero: after.hero, welcome: after.welcome, strip: after.strip }) +
        '\n              The stored half is load-bearing rather than a convenience: wouter drops the' +
        '\n              query string the moment it navigates to /post/:postId.',
    )
  }

  await ctx.close()
  return { errors, done: true }
}

// ═════════════════════════════════════════════════════════════════════════════
// RUN B — a fresh window has no place
// ═════════════════════════════════════════════════════════════════════════════

async function runFreshWindow() {
  const run = 'fresh-window'
  console.log(`\n── A FRESH WINDOW ${'─'.repeat(47)}`)
  const { ctx, page, errors } = await freshContext('light', DESKTOP)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  const booted = await bootedWithTheme(page, 'light', WELCOME)
  const seen = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })
  check(
    run, 5,
    'a fresh context with no stored place lands on the welcome screen — the choice does not outlive the window',
    booted && seen.welcome && seen.strip === null,
    `themeOk=${booted} welcome=${seen.welcome} strip=${JSON.stringify(seen.strip)}` +
      '\n              This is also the light-mode boot assertion: the cookie was set to `light` and' +
      '\n              documentElement.classList was read back.',
  )
  await ctx.close()
  return { errors }
}

// ═════════════════════════════════════════════════════════════════════════════
// RUN C — the unincorporated case: a county row, four tabs, no City
// ═════════════════════════════════════════════════════════════════════════════

async function runUnincorporated() {
  const run = 'unincorporated'
  console.log(`\n── AN UNINCORPORATED PLACE (A COUNTY ROW) ${'─'.repeat(23)}`)
  const { ctx, page, errors, counters } = await freshContext('dark', DESKTOP)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark', WELCOME))) {
    check(run, 6, 'the page booted with the requested theme', false, 'the welcome screen never mounted.')
    await ctx.close()
    return { errors }
  }

  await typeInto(page, PICKER, COUNTY_QUERY)
  const firstRow = await page.locator(`${PICKER} [role="option"]`).first().innerText()
  await page.locator(`${PICKER} [role="option"]`).first().click()
  const settledOn = await settle(page)
  await page.waitForTimeout(2500)

  const seen = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })
  // Nothing on screen may read as a failure. These are the words an error state
  // would use; the honest no-city answer uses none of them.
  const errorish = /(went wrong|couldn't|could not|unable to|try again|error)/i.test(seen.bodyText)
  check(
    run, 6,
    `an unincorporated place yields FOUR tabs and no City, through the county branch — and reads as an answer, not an error (first row: "${firstRow.replace(/\s+/g, ' ').trim()}")`,
    settledOn === 'shell' &&
      seen.railTabs.join(',') === 'county,state,federal,unified' &&
      Array.isArray(seen.modules) &&
      seen.modules.length > 0 &&
      !errorish &&
      counters.coordinate === 0,
    `settledOn=${settledOn} railTabs=${JSON.stringify(seen.railTabs)} modules=${JSON.stringify(seen.modules)} errorish=${errorish} ` +
      `coordinate-lookup=${counters.coordinate}` +
      '\n              🔴 coordinate-lookup must be ZERO here, and that is the assertion that proves' +
      '\n              this went through the COUNTY branch: a county row is `complete` and needs no' +
      '\n              second leg. One call would mean the city branch ran and the first row was not' +
      '\n              the county — run `node scripts/check-place-resolve.mjs --live`, which pins' +
      "\n              place-search-buncombe.json's first row as the G4020." +
      '\n              A missing City tab is an ANSWER: ev-accounts says `city` is null for an' +
      '\n              unincorporated address outright.',
  )
  await ctx.close()
  return { errors }
}

// ═════════════════════════════════════════════════════════════════════════════
// RUN D — nothing matched, and keyboard only
// ═════════════════════════════════════════════════════════════════════════════

async function runNoResultsAndKeyboard() {
  const run = 'no-match+keys'
  console.log(`\n── NOTHING MATCHED, THEN KEYBOARD ONLY ${'─'.repeat(26)}`)
  const { ctx, page, errors, counters } = await freshContext('dark', DESKTOP)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark', WELCOME))) {
    check(run, 7, 'the page booted with the requested theme', false, 'the welcome screen never mounted.')
    await ctx.close()
    return { errors }
  }

  // ── 7  An answer with a way forward, never a blank list ───────────────────
  await typeInto(page, PICKER, NO_MATCH, { expectOptions: false })
  {
    const state = await page.evaluate(
      ({ picker }) => {
        const p = document.querySelector(picker)
        return {
          options: p ? p.querySelectorAll('[role="option"]').length : -1,
          problem: (p?.querySelector('[data-place-picker-problem]')?.textContent || '').trim(),
          stillWelcome: !!document.querySelector('[data-welcome-screen]'),
        }
      },
      { picker: PICKER },
    )
    check(
      run, 7,
      'a query that matches nothing produces the honest line — not a blank list, and not a nearest match',
      state.options === 0 &&
        /Nothing matched/i.test(state.problem) &&
        state.stillWelcome &&
        counters.search > 0,
      JSON.stringify(state) + ` location-search=${counters.search}` +
        '\n              🔴 "Never invent a place." Treasury Tracker resolving an unknown slug to' +
        "\n              Bloomington, IN's budget is the precedent: a real answer for the wrong place is" +
        '\n              worse than no answer. `location-search` > 0 is the positive half — a query' +
        '\n              that was never sent also shows zero options.',
    )
  }

  // ── 11  Keyboard only ─────────────────────────────────────────────────────
  {
    // Tab to the combobox from the top of the document, bounded.
    await page.evaluate(() => document.body.focus())
    let reached = false
    for (let i = 0; i < 40 && !reached; i += 1) {
      await page.keyboard.press('Tab')
      reached = await page.evaluate(
        (sel) => document.activeElement === document.querySelector(`${sel} input[role="combobox"]`),
        PICKER,
      )
    }
    await page.keyboard.type(PLACE_NAME.toLowerCase())
    await page.waitForSelector(`${PICKER} [role="option"]`, { timeout: 10000 })

    // Escape closes the list and KEEPS the text — clearing it would throw away
    // what someone just typed because they wanted the list out of the way.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const afterEscape = await page.evaluate(
      (sel) => ({
        options: document.querySelectorAll(`${sel} [role="option"]`).length,
        value: document.querySelector(`${sel} input[role="combobox"]`)?.value ?? null,
      }),
      PICKER,
    )

    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
    const loaded = (await settle(page)) === 'shell'
    await page.waitForTimeout(2500)
    const seen = loaded ? await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR }) : { hero: null }

    check(
      run, 11,
      'keyboard only: Tab reaches the picker, Escape closes the list and keeps the text, ArrowDown + Enter loads the place',
      reached &&
        afterEscape.options === 0 &&
        afterEscape.value === PLACE_NAME.toLowerCase() &&
        seen.hero === PLACE_NAME,
      `reachedByTab=${reached} afterEscape=${JSON.stringify(afterEscape)} hero=${JSON.stringify(seen.hero)}` +
        '\n              Mouse-only selection is the failure this repo names by hand, and a combobox' +
        '\n              whose Escape wipes the input is the one people meet second.',
    )
  }

  await ctx.close()
  return { errors }
}

// ═════════════════════════════════════════════════════════════════════════════
// RUN E — a signed-in member goes and looks at another city, and comes back
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 The member is in BLOOMINGTON and the place they visit is ASHEVILLE, and
 * that pairing is not incidental. `?dev=1` alone puts the dev guest in Asheville,
 * so visiting the Asheville fixture would make the viewer a member of the
 * jurisdiction on screen — `whyNoWrite` would answer `sibling-shard`, not
 * `other-place`, and the run would be about the wrong state entirely.
 */
const OWN_POST_ID = 'mock-city-post-1'

async function runMemberVisit() {
  const run = 'member-visit'
  console.log(`\n── A SIGNED-IN MEMBER VISITS ANOTHER CITY ${'─'.repeat(23)}`)
  // 🔴 `cs_active_tab` is PLANTED as 'city' rather than cleared. Cleared, the
  // shell opens on 'federal' (AppShell's default) and the member's control-case
  // banner reads "United States of America" — true, and about the wrong level,
  // so "the banner comes back to Bloomington after leaving" would be asserting
  // against a tab the member never sat on.
  //
  // 🔴 Planting only, and NOTHING is cleared. This init script re-runs on the
  // `/post/` navigation below — `addInitScript` runs before every document load
  // — so a `sessionStorage.removeItem('cs_viewed_place')` here would delete the
  // visited place a moment before `openPost` was asked to, and assertion 9 would
  // pass having proved nothing. Re-planting the same tab is idempotent and
  // harmless, which is the test a line in here has to meet.
  const { ctx, page, errors, counters, requests } = await freshContext('dark', DESKTOP, () => {
    try { localStorage.setItem('cs_active_tab', 'city') } catch { /* blocked */ }
  })
  await page.goto(`${ORIGIN}/?dev=1&place=bloomington`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark', RAIL))) {
    check(run, 'boot', 'the page booted with the requested theme', false, 'the member shell never mounted.')
    await ctx.close()
    return { errors }
  }

  const own = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })
  const ownControl = own.strip === 'own' && own.hero === 'Bloomington'
  check(
    run, '8-ctl',
    `CONTROL CASE — the member starts on their OWN spaces: banner "${own.hero}", strip offering "${own.stripText}"`,
    ownControl,
    JSON.stringify({ hero: own.hero, strip: own.strip, stripText: own.stripText }) +
      '\n              Assertion 8 is about LEAVING a place and getting back to this. Without it,' +
      '\n              "the banner reads Bloomington afterwards" is true of a run that never went' +
      '\n              anywhere.',
  )
  if (!ownControl) {
    skip('8, 9, NET', 'the member run — NOT CHECKED; it never started on the member\'s own spaces.')
    await ctx.close()
    return { errors }
  }

  // ── Enter Asheville from the SHELL, which is the half the welcome screen
  //    cannot cover: the banner and the tab bar only exist on this path.
  requests.recording = true
  await page.locator(`${STRIP} button[aria-expanded]`).first().click()
  await page.waitForTimeout(300)
  await typeInto(page, STRIP, PLACE_NAME.toLowerCase())
  await page.locator(`${STRIP} [role="option"]`).first().click()
  await page.waitForTimeout(3000)

  const visiting = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })
  const seen = await traverse(page, 'city')
  const hits = postgrestHits(requests.seen)
  check(
    run, 'NET',
    'entering a place FROM THE SHELL sends nothing about it to the database either — both views, City and Federal',
    visiting.hero === PLACE_NAME &&
      hits.length === 0 &&
      seen.every((s) => s.endsWith(':true')) &&
      counters.coordinate === 1,
    `hero=${JSON.stringify(visiting.hero)} traversed=${JSON.stringify(seen)} ` +
      `postgrestHits=${JSON.stringify(hits.slice(0, 5))} coordinate-lookup=${counters.coordinate}` +
      '\n              🔴 The shell path is the one with a hero banner and a sticky tab bar on it.' +
      '\n              ActiveHeroBanner calls useSiblingSlices for EVERY visited place, and the shard' +
      '\n              switcher and feed search sit in that bar OUTSIDE the FEED_TABS map — so the' +
      '\n              welcome-screen run alone would have left three surfaces untested.' +
      '\n              A `traversed` entry reading `:false` means the view never came up and the' +
      '\n              absence beside it is a statement about nothing.',
  )

  // ── 9  A deep link to the member's OWN post clears the place ──────────────
  //
  // Same context, so the visited place is still in sessionStorage and the shell
  // hydrates INTO it before the route effect runs. That ordering is the bug:
  // without openPost's clear, the member's own thread renders inside a shell
  // pointed at another city, with the gate computed against a slice that is not
  // on screen.
  //
  // 🔴 The stored place is read HERE, before the navigation, and asserted below.
  // "The place is gone afterwards" is also true of a place that was never there
  // — which is exactly what an over-eager init script produced the first time
  // this run was written (see the note where CLEAN_PROFILE used to be).
  const storedBeforeLink = await page.evaluate(() => {
    try { return sessionStorage.getItem('cs_viewed_place') } catch { return 'blocked' }
  })
  await page.goto(`${ORIGIN}/post/${OWN_POST_ID}?dev=1&place=bloomington`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(RAIL, { timeout: 25000 })
  await page.waitForTimeout(4000)
  {
    const after = await page.evaluate(
      ({ post }) => ({
        path: location.pathname,
        onPostRoute: location.pathname === `/post/${post}`,
        hero: document.querySelector('h2')?.innerText?.trim() ?? null,
        strip: document.querySelector('[data-place-strip]')?.getAttribute('data-place-strip') ?? null,
        stripText: (document.querySelector('[data-place-strip]')?.innerText || '').replace(/\s+/g, ' ').trim(),
        threadOnScreen: /sidewalk repairs/i.test(document.body.innerText || ''),
        stored: (() => { try { return sessionStorage.getItem('cs_viewed_place') } catch { return 'blocked' } })(),
      }),
      { post: OWN_POST_ID },
    )
    check(
      run, 9,
      "a /post/ deep link while visiting clears the place and opens the MEMBER'S OWN thread",
      !!storedBeforeLink &&
        storedBeforeLink !== 'blocked' &&
        after.onPostRoute &&
        after.threadOnScreen &&
        after.hero === 'Bloomington' &&
        after.strip === 'own' &&
        after.stored === null,
      `storedBeforeLink=${storedBeforeLink} ` + JSON.stringify(after) +
        '\n              🔴 storedBeforeLink null is the VACUOUS case and is checked first: the place' +
        '\n              was never on screen, so "it is gone now" says nothing at all.' +
        '\n              🔴 threadOnScreen false is the other vacuous case, not a gate failure: the link did' +
        '\n              not resolve, so everything beside it is a statement about the home feed. Look' +
        '\n              at getMockPostById in src/lib/devMockData.ts first — it hard-codes its array' +
        '\n              list, so a post registered only in MOCK_FEEDS is invisible to it.' +
        '\n              A hero still reading Asheville is openPost not clearing the place; a' +
        '\n              `stored` value still set is the storage half of the same clear.',
    )
  }

  // ── 9b  Entering a place CLOSES the thread that belonged to the last one ──
  //
  // 🔴 Added because the revert matrix found it missing. Removing
  // `clearPlaceScopedState()` from `enterPlace` turned NOTHING red: the plan
  // predicted assertion 9, but that assertion goes through `openPost` and says
  // nothing about `enterPlace`. The state is left over from the member's OWN
  // thread, which is still open from assertion 9 above — so this starts exactly
  // where the bug would start.
  {
    const before = await page.evaluate(() => ({
      thread: /sidewalk repairs/i.test(document.body.innerText || ''),
      path: location.pathname,
    }))
    await page.locator(`${STRIP} button[aria-expanded]`).first().click()
    await page.waitForTimeout(300)
    await typeInto(page, STRIP, PLACE_NAME.toLowerCase())
    await page.locator(`${STRIP} [role="option"]`).first().click()
    await page.waitForTimeout(3000)
    const after = await page.evaluate(() => ({
      hero: document.querySelector('h2')?.innerText?.trim() ?? null,
      thread: /sidewalk repairs/i.test(document.body.innerText || ''),
      path: location.pathname,
    }))
    check(
      run, '9b',
      "entering a place closes the thread that belonged to the last one, and the URL closes with it",
      before.thread && before.path.startsWith('/post/') && after.hero === PLACE_NAME && !after.thread && after.path === '/',
      `before=${JSON.stringify(before)} after=${JSON.stringify(after)}` +
        '\n              🔴 `before.thread` false is the vacuous case and is checked first: no thread was' +
        '\n              open, so "it is closed now" is a statement about nothing.' +
        '\n              A thread still on screen is enterPlace not clearing activePostIds — the member\'s' +
        '\n              own post rendered inside a shell pointed at another city, with the gate computed' +
        '\n              against a slice that is not on screen. A path still /post/… is the URL half of' +
        '\n              the same clear, and it is what makes a reload reopen it.',
    )
  }

  // ── 8  Leave returns the member to their own tabs and own banner ──────────
  await page.goto(`${ORIGIN}/?dev=1&place=bloomington`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(RAIL, { timeout: 25000 })
  await page.waitForTimeout(2000)
  await page.locator(`${STRIP} button[aria-expanded]`).first().click()
  await page.waitForTimeout(300)
  await typeInto(page, STRIP, PLACE_NAME.toLowerCase())
  await page.locator(`${STRIP} [role="option"]`).first().click()
  await page.waitForTimeout(3000)
  const entered = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })

  let leaveClicked = true
  try {
    await page.locator(LEAVE).click({ timeout: 5000 })
  } catch {
    leaveClicked = false
  }
  await page.waitForTimeout(2500)
  const back = await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR })
  check(
    run, 8,
    'the strip enters a place, and LEAVE returns the member to their own tabs and own banner',
    entered.hero === PLACE_NAME &&
      entered.strip === 'visiting' &&
      leaveClicked &&
      back.hero === 'Bloomington' &&
      back.strip === 'own' &&
      back.railTabs.join(',') === 'city,county,state,federal,unified,volunteer' &&
      entered.railTabs.join(',') === 'city,county,state,federal,unified',
    `entered=${JSON.stringify({ hero: entered.hero, strip: entered.strip, railTabs: entered.railTabs })} leaveClicked=${leaveClicked} ` +
      `back=${JSON.stringify({ hero: back.hero, strip: back.strip, railTabs: back.railTabs })}` +
      '\n              The Volunteer tab coming back is part of it: placeSlices never carries one, so' +
      '\n              its absence while visiting and its return on leaving are the same fact seen' +
      '\n              twice. A notice or a strip that explains a state and offers no way out is' +
      '\n              research Pitfall 8.',
  )

  await ctx.close()
  return { errors }
}

// ═════════════════════════════════════════════════════════════════════════════
// RUN F — storage blocked
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 THE SCOPE OF THIS BLOCK IS THE POINT, and it is narrower than the plan
 * asked for. Read this before "fixing" it.
 *
 * 17-05's plan said: override `Storage.prototype` and let the app meet a storage
 * that throws on every key. **That assertion cannot pass in a browser, and not
 * because of anything this phase wrote.** `src/lib/supabase.ts` calls
 * `createClient` at MODULE SCOPE, unconditionally; `createClient` constructs a
 * `RealtimeClient` → `SocketAdapter` → `Socket`, and that `Socket` touches
 * `sessionStorage` with no guard of its own. Replace the whole storage object
 * and the page dies on an uncaught `SecurityError` before a line of our code
 * runs — on every route, in every environment, signed in or out, with or without
 * Phase 17, and reproduced identically on `?dev=1`. It is item 1 of this phase's
 * `deferred-items.md`, with the captured stack, and it is somebody's own small
 * PR rather than a phase plan's.
 *
 * `localStorage` is excluded for the sibling reason: `useAuth.ts` reads and
 * removes `cs_token` unguarded (item 9 of 16-explore-by-slice's deferred items).
 * Blocking it would turn this red for a bug that predates the phase.
 *
 * So the throw is scoped to **`sessionStorage`, keys beginning `cs_`** — which
 * is EXACTLY the set Phase 17 added: `cs_viewed_place` (17-03),
 * `cs_signed_out` (17-01) and `cs_dev_place` (pre-existing and already
 * guarded). Every other key passes through untouched, so the dependency boots
 * and our guards are the only thing under test. That is the claim
 * 17-VALIDATION.md makes — *"this phase adds no second instance — every new
 * access is guarded"* — and it is the whole of what a browser can honestly be
 * asked here.
 *
 * What this does NOT cover, stated rather than implied: whether the app survives
 * a storage that is blocked WHOLESALE. It does not, today, and the reason is in
 * a dependency.
 */
const BLOCK_OUR_SESSION_KEYS = () => {
  // 🔴 `Storage.prototype` IS SHARED between sessionStorage and localStorage, and
  // forgetting that is not hypothetical — the first draft of this check did, and
  // the page died on an uncaught SecurityError with nothing rendered. The cause
  // was `useAuth.ts` reading and removing `cs_token` from LOCAL storage
  // unguarded: item 9 of 16-explore-by-slice/deferred-items.md, reproduced
  // exactly, by a check that meant to test something else. Hence the receiver
  // test — the prototype is still genuinely overridden, which is what makes this
  // a real block rather than a mock, but only sessionStorage feels it.
  const proto = Object.getPrototypeOf(window.sessionStorage)
  const ours = (k) => typeof k === 'string' && k.startsWith('cs_')
  for (const name of ['getItem', 'setItem', 'removeItem']) {
    const original = proto[name]
    proto[name] = function patched(key, ...rest) {
      if (this === window.sessionStorage && ours(key)) {
        const err = new Error('blocked')
        err.name = 'SecurityError'
        throw err
      }
      return original.call(this, key, ...rest)
    }
  }
  window.__csBlockedKeys = true
}

async function runStorageBlocked() {
  const run = 'storage-blocked'
  console.log(`\n── SESSION STORAGE BLOCKED FOR THIS APP'S OWN KEYS ${'─'.repeat(14)}`)
  const { ctx, page, errors, counters } = await freshContext('dark', DESKTOP, BLOCK_OUR_SESSION_KEYS)
  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })

  let welcomeUp = false
  try {
    await page.waitForSelector(WELCOME, { timeout: 25000 })
    welcomeUp = true
  } catch { /* reported below */ }
  await page.waitForTimeout(1500)

  const patched = await page.evaluate(() => {
    let threw = false
    try { window.sessionStorage.setItem('cs_probe', '1') } catch { threw = true }
    let passthrough = false
    try {
      window.sessionStorage.setItem('not_ours_probe', '1')
      passthrough = window.sessionStorage.getItem('not_ours_probe') === '1'
      window.sessionStorage.removeItem('not_ours_probe')
    } catch { passthrough = false }
    // localStorage must be untouched — see the comment above the init script.
    let localUntouched = false
    try {
      window.localStorage.setItem('cs_probe', '1')
      localUntouched = window.localStorage.getItem('cs_probe') === '1'
      window.localStorage.removeItem('cs_probe')
    } catch { localUntouched = false }
    return { threw, passthrough, localUntouched, installed: window.__csBlockedKeys === true }
  })

  let placeLoaded = false
  if (welcomeUp) {
    try {
      await typeInto(page, PICKER, PLACE_NAME.toLowerCase())
      await page.locator(`${PICKER} [role="option"]`).first().click()
      placeLoaded = (await settle(page)) === 'shell'
      await page.waitForTimeout(2500)
    } catch { /* reported below */ }
  }
  const seen = placeLoaded ? await page.evaluate(readPlace, { panel: PANEL, rail: RAIL, bar: TABBAR }) : { hero: null }

  check(
    run, 12,
    "with this app's own sessionStorage keys throwing: the welcome screen still renders, a place still loads for the session, and nothing throws",
    patched.installed &&
      patched.threw &&
      patched.passthrough &&
      patched.localUntouched &&
      welcomeUp &&
      placeLoaded &&
      seen.hero === PLACE_NAME &&
      counters.coordinate === 1 &&
      errors.page.length === 0,
    `probe=${JSON.stringify(patched)} welcomeUp=${welcomeUp} placeLoaded=${placeLoaded} hero=${JSON.stringify(seen.hero)} ` +
      `pageErrors=${JSON.stringify(errors.page.slice(0, 2))}` +
      '\n              🔴 `probe.threw` false means the override did not take and this assertion tested' +
      '\n              NOTHING — a try/catch that was never exercised is the same as one that is not' +
      '\n              there. `probe.passthrough` false means the block is too WIDE: it is scoped to' +
      '\n              `cs_` keys on purpose, because a wholesale block kills the page inside' +
      '\n              @supabase/supabase-js before our code runs (deferred-items.md item 1).' +
      '\n              `probe.localUntouched` false means it leaked onto localStorage through the' +
      '\n              SHARED Storage.prototype, which reproduces useAuth.ts\'s unguarded cs_token' +
      '\n              access (16-explore-by-slice deferred item 9) and kills the page for a bug that' +
      '\n              predates this phase. Read the long comment above this function before widening' +
      '\n              any of it.',
  )

  await ctx.close()
  return { errors }
}

// ── Go ───────────────────────────────────────────────────────────────────────

const all = []
all.push(await runSignedOutWalk())
all.push(await runFreshWindow())
all.push(await runUnincorporated())
all.push(await runNoResultsAndKeyboard())
all.push(await runMemberVisit())
all.push(await runStorageBlocked())

await browser.close()

// ── 13  Errors, across every run ─────────────────────────────────────────────
{
  const page = all.flatMap((r) => r.errors.page)
  const console_ = all.flatMap((r) => r.errors.console)
  const noise = all.flatMap((r) => r.errors.noise)
  console.log(`\n── ERRORS ${'─'.repeat(54)}`)
  if (noise.length) {
    console.log(
      `  (noise) ${noise.length} expected network errors suppressed: ` +
        [...new Set(noise)].map((t) => t.slice(0, 64)).join(' | '),
    )
  }
  check(
    'all-runs', 13,
    'zero uncaught page errors and zero unexpected console errors throughout',
    page.length === 0 && console_.length === 0,
    [...page, ...console_].slice(0, 4).join('\n              ') +
      '\n              A thrown render is not a gate: an exception while hiding a control can leave' +
      '\n              the control on screen.',
  )
}

console.log(`\n${passed} PASS, ${failed} FAIL`)
if (failed) {
  console.log(`red: ${reds.join(', ')}`)
  console.log(
    'Read WHICH RUN failed. A control case red means everything under it is a statement\n' +
      'about a page that never got a place — fix that first and ignore the rest. A D-13 red\n' +
      'is never to be relaxed: if the tracer is on screen because an input still holds it,\n' +
      'clear the input in the check; if it is in storage, find what wrote it.',
  )
}
process.exit(failed === 0 ? 0 : 1)
