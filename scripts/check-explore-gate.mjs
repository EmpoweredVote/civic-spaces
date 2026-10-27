#!/usr/bin/env node
/**
 * check-explore-gate.mjs — the app must offer no write where RLS refuses one.
 *
 * Run: npm run dev, then npm run check:explore-gate [-- --port 5173]
 * No credential: it drives `?dev=1` (the reserved dev-guest id) and
 * `?signedout=1` (dev-only, which clears cs_token for the life of the page).
 *
 * 🔴 TWO AXES: tab, and VIEWER. The tab axis came first and is why the member
 * run covers City as well as Federal. The viewer axis is Phase 17's: the gate
 * stopped being "a sibling shard of your own jurisdiction" and became "one of
 * four reasons you may not write here" (src/lib/writeAccess.ts), so a viewer who
 * holds nothing is a third CASE for this check and not a second check.
 *
 *   | viewer                | how it is reached      | its control case            |
 *   |-----------------------|------------------------|-----------------------------|
 *   | member-sibling-shard  | ?dev=1 then Slice 2    | the affordances are PRESENT |
 *   |                       | (City and Federal)     | on the member's own shard   |
 *   | signed-out            | ?signedout=1, then a   | INVERTED — see below        |
 *   |                       | place NAMED in the     |                             |
 *   |                       | welcome screen's picker|                             |
 *   | member-no-slice       | ?dev=1&place=arden     | County is writable          |
 *   | member-other-place    | ?dev=1&place=bloomington,| the affordances are PRESENT|
 *   |                       | then Asheville through | on the member's own spaces  |
 *   |                       | the shell's place strip| before the trip             |
 *
 * 🔴 FOUR VIEWERS, NOT SIX, AND THAT IS A CORRECTION TO 17-06's PLAN.
 *
 * That plan asked for `member-other-place` AND `observer-with-a-place` as two
 * new viewers. Only the first is new. **`observer-with-a-place` IS the
 * `signed-out` viewer**: 17-04 deleted the placeless signed-out Explore (D-09)
 * and re-pointed this run at a place named in the welcome screen's picker, so
 * "signed out" and "an observer looking at a place" have been ONE STATE since
 * that plan landed — there is no placeless signed-out Explore left for a
 * separate viewer to be about. A near-identical sixth run would have doubled
 * the runtime and left two readers for one state, which is the fork this file's
 * own rule forbids. What 17-06 asked for THAT viewer — the seed invitation
 * absent, the hero naming the place, assertion 8 at a visited place — is added
 * to it below, as assertions 8, 9 and 10. Its id stays `signed-out` so the
 * `red:` list and 17-VALIDATION's references still read.
 *
 * 🔴 Never fork this file. 17-02 added the signed-out and no-slice viewers;
 * 17-04 RE-POINTED the signed-out one when it deleted the placeless signed-out
 * Explore that viewer was written against (D-09); 17-06 adds the
 * member-other-place viewer and extends the observer.
 * One script, one set of readers.
 *
 * 🔴 This repo shipped exactly half of this gate once already — the feed was
 * gated and the thread was not (CLAUDE.md). The reason it shipped half-done is
 * that nothing failed when it did. So the gate is checked rather than remembered.
 *
 * 🔴 Runs on BOTH the Federal and the City shards. Four of the ten write
 * affordances in 16-RESEARCH Finding 5 — "Share an idea", the Imagine textarea,
 * the Nearby dialog and "Save on this device" — exist only on City/County,
 * because DEFAULT_MODULES.federal carries neither `imagine` nor `nearby`. A
 * Federal-only run would report "no textarea found" about a tab that never had
 * one, which is a true statement about nothing.
 *
 * 🔴 And every run states its CONTROL CASE first: the affordances are PRESENT on
 * the member's own shard. Without it, a build that hid everything everywhere
 * would pass all the rest. Two of the control case's steps need an interaction
 * before the control exists at all, and both are easy to lose:
 *
 *   - the Imagine textarea and "Share an idea" are inside `{option && …}`
 *     (ExploreActivities) and the persisted default is `imagine: null`
 *     (exploreStorage), so on a fresh profile NEITHER exists until a radio is
 *     chosen. The click below is not a stray line — delete it and the control
 *     case fails on the first run in a perfectly ungated build.
 *   - "Save on this device" lives inside a <dialog> and is not in the DOM until
 *     the dialog is opened.
 *
 * 🔴 Assertions 2–5 are evaluated on the LIST view and again inside an OPENED
 * TOPIC, and both must hold. The draft form lived on the topic page, not the
 * list; checking only the list is precisely the "gated the feed, not the thread"
 * shape this plan exists to prevent.
 *
 * 🔴 Playwright's `colorScheme` context option does nothing in this app. Dark is
 * class-based and is set before first paint from the `ev_color_scheme` cookie,
 * never from `prefers-color-scheme` (src/lib/colorScheme.ts). So the theme here
 * is set by cookie-and-class and `documentElement.classList` is ASSERTED to
 * match — asking for light and silently rendering dark is the failure that
 * guards against.
 *
 * 13 assertions x 2 tabs for the member/sibling viewer, then the two viewers
 * Phase 17 adds. If one tab is red and the other green, read that carefully: a
 * City-only failure with Federal passing is the half-a-gate shape.
 */

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = arg('--port', '5173')
const ORIGIN = `http://localhost:${PORT}`

/** The Explore tab panel (FORUM_VIEW_PANEL_ID.explore). CSS-hidden, not unmounted,
 *  while Conversations shows — so every query is scoped to it. An unscoped
 *  document.querySelector reads the other panel too and reports nonsense. */
const PANEL = '#forum-view-explore'

/** The Conversations tabpanel — where the FEED's own notice lives. Also CSS-hidden. */
const FEED_PANEL = '#forum-view-conversations'

/**
 * The welcome screen, and the place picker on it.
 *
 * 🔴 This replaces `[data-signed-out-explore]`, and the replacement is the whole
 * point of the viewer below. 17-02 wrote the signed-out viewer against the
 * `geoid: null` Explore a stranger used to get; 17-04 DELETED that screen (D-09,
 * "an explore of a blank space which doesn't make a ton of sense") and so owns
 * re-pointing this. A red check carried across a plan boundary stops being read,
 * and the next person to see it assumes it was already red.
 *
 * An observer's Explore is now the REAL `#forum-view-explore`, because naming a
 * place renders the real shell — so after the walk below this viewer uses the
 * same PANEL every other viewer does.
 */
const WELCOME = '[data-welcome-screen]'
const PICKER = '[data-place-picker]'

/**
 * The place the signed-out viewer names, and the frozen answers it is given.
 *
 * 🔴 Served by route interception from 17-03's committed fixtures rather than
 * from the live API, so this viewer is deterministic and goes red on OUR gate
 * rather than on a ranking change at ev-accounts. `place-search-asheville.json`
 * was captured from the real endpoint and `check:place-resolve --live` is what
 * keeps it honest; 17-05's browser check serves the same two.
 *
 * The SECOND leg is not optional. A chosen place row answers city + state; the
 * county comes from `POST /api/essentials/coordinate-lookup` against the
 * gazetteer centroid, and without it `resolveChosenPlace` throws `no-county` and
 * the viewer never leaves the welcome screen — which is precisely the vacuous
 * shape assertion 1 below exists to catch.
 */
const PLACE_QUERY = 'asheville'
const PLACE_NAME = 'Asheville'

/** The shell's place control (17-05), and the way out of a place. */
const STRIP = '[data-place-strip]'

/** The nav rail, and 17-05's per-tab hook on it — City/County render RESOLVED names. */
const RAIL = 'nav[aria-label="Civic space navigation"]'

/**
 * The member viewer 5 travels FROM, and the geoids either end of the trip.
 *
 * 🔴 Bloomington, Indiana — deliberately not Asheville. Visiting Asheville from
 * the Asheville fixture would compare a roster against itself and pass no matter
 * what, which is the vacuous shape this whole script is written against. Both
 * gazetteer shards are committed (public/geo/18.json, public/geo/37.json).
 */
const OWN_CITY_GEOID = '1805860'
const VISITED_CITY_GEOID = '3702140'

/**
 * 🔴 D-10, and the assertion `deferred-items.md` item 2 had nobody watching.
 *
 * Every alternative here is a string that was ON SCREEN over Asheville, read by
 * a visitor from anywhere, until 17-06 Task 2: "Welcome to YOUR Civic Space",
 * "Federal races WHERE YOU LIVE", "None of YOURS has one published yet". The
 * data under them was already right; only the second person was wrong, which is
 * exactly what D-10 forbids — *never show someone a place as if it were already
 * theirs.*
 *
 * 🔴 NARROW ON PURPOSE, and the omissions are a deferral rather than an
 * oversight. The generic topic catalogue (`src/mocks/civicSpacesExplore.ts`)
 * still asks "What should get built in YOUR city, and where?" and ~40 more like
 * it. Those are the conversation-starter QUESTIONS, the second person is what
 * makes them an invitation rather than a survey item, and rewriting them is a
 * decision about the product's voice — logged as item 3 of this phase's
 * `deferred-items.md` with file and line. 🔴 Do NOT widen this regex to cover
 * them without fixing them first: a check that is red on purpose is a check
 * nobody reads.
 *
 * The matching half for the static ROOM copy is `check:explore-rooms` 21.
 */
const CLAIMS_THE_PLACE =
  /Welcome to your Civic Space|happening in your community|across your state|share your perspective|Questions for your community|races where you live|your (own )?area|your ballot|None of yours|your legislators|What your local government|your local election office/i

/** Text that can only come from a write affordance. Affordances #1, #2, #7 and #8. */
const WRITE_WORDS = 'Join the conversation|Share an idea|Discard draft|Sign in to (join|share)|Post it in .* instead'

/**
 * One short, stable phrase per reason — the thing the notice must SAY when
 * whyNoWrite() answered that reason, and must not say when it answered another.
 *
 * 🔴 A phrase, never the whole sentence: a copy edit must not become a false
 * failure. And the match runs against rendered text only, so these never appear
 * in a component's comments — a gate matching its own documentation is worse
 * than no gate, because it goes green for the wrong reason.
 */
const REASON_WORDS = {
  'sibling-shard': /Slice \d+ read-only/,
  'signed-out': /an address set/i,
  'no-slice': /no community at this level/i,
  'other-place': /place you're not a member of/i,
}

/**
 * The two tabs, and the fixture sibling post each one's deep link uses.
 * Both ids are registered in MOCK_SIBLINGS, MOCK_FEEDS *and* getMockPostById
 * (src/lib/devMockData.ts). The third is the one that bites: without it
 * locatePost returns `unavailable` and assertion 10 runs on the home feed.
 */
const TABS = [
  {
    tab: 'city',
    // City/County are the only levels whose composition has `imagine` and `nearby`.
    hasImagine: true,
    siblingPostId: 'mock-city-2-post-1',
    // A reply ON that post (devMockData MOCK_REPLIES). Assertion 14 needs a
    // ReplyCard to actually mount, or the thread's reply gate is untested.
    siblingReplyText: 'A reply in City Slice 2.',
    // MOCK_SLICES.city.geoid — the planted draft key must match what the effect rebuilds.
    draftKey: 'city|3702140|safer-walking',
    resume: { sliceType: 'city', geoid: '3702140', topicId: 'safer-walking' },
  },
  {
    tab: 'federal',
    hasImagine: false,
    siblingPostId: 'mock-federal-2-post-1',
    siblingReplyText: 'A reply in Federal Slice 2.',
    // federal is PLACELESS, so its draft key carries no geoid segment at all.
    draftKey: 'federal|foreign-policy',
    resume: { sliceType: 'federal', geoid: null, topicId: 'foreign-policy' },
  },
]

/**
 * Console noise `?dev=1` produces by design, and that is NOT a gate failure:
 * CLAUDE.md records that member-only APIs 401 for the dev id, and the accounts
 * session endpoint sends no CORS header for localhost. Everything else counts.
 * The suppressed lines are printed, so this allowlist cannot quietly become a
 * place a real error hides.
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

function check(tab, n, label, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`  PASS ${String(n).padStart(2)}  ${label}`)
  } else {
    failed += 1
    reds.push(`${tab} #${n}`)
    console.log(`  FAIL ${String(n).padStart(2)}  ${label}${detail === undefined ? '' : `\n            ${detail}`}`)
  }
}

const DESKTOP = { width: 1440, height: 1000 }
const MOBILE = { width: 390, height: 844 }

// ── Page-side readers (one serialisable argument each) ───────────────────────

/** Everything the write-affordance assertions need, scoped to the Explore panel. */
function readPanel({ sel, words }) {
  const p = document.querySelector(sel)
  if (!p) return { missing: true }
  if (p.offsetParent === null) return { hidden: true }
  const text = p.innerText || ''
  return {
    submits: p.querySelectorAll('button[type="submit"]').length,
    textareas: p.querySelectorAll('textarea').length,
    forms: p.querySelectorAll('form').length,
    // Radios and checkboxes are view preferences (affordance #10), never writes.
    freeTextInputs: [...p.querySelectorAll('input')].filter(
      (i) => i.type !== 'radio' && i.type !== 'checkbox',
    ).length,
    writeWord: new RegExp(words).exec(text)?.[0] ?? null,
    notice: !!p.querySelector('[data-explore-view-only-notice]'),
    modules: [...p.querySelectorAll('[data-explore-module]')].map((d) => d.dataset.exploreModule),
  }
}

/**
 * The read-only notice inside one surface: which reason it names, and whether it
 * carries a control.
 *
 * 🔴 `reason` comes off the data attribute AND the wording is checked separately.
 * The attribute alone would pass on a component that received the reason and
 * rendered someone else's sentence; the wording alone would pass on one that
 * guessed. Both, or neither is evidence.
 */
function readNotice({ sel }) {
  const p = document.querySelector(sel)
  if (!p) return { panel: false }
  const n = p.querySelector('[data-read-only-notice]')
  if (!n) return { panel: true, found: false }
  return {
    panel: true,
    found: true,
    visible: n.offsetParent !== null,
    reason: n.getAttribute('data-read-only-notice'),
    surface: n.getAttribute('data-read-only-surface'),
    text: (n.innerText || '').replace(/\s+/g, ' ').trim(),
    button: !!n.querySelector('button'),
    link: n.querySelector('a')?.getAttribute('href') ?? null,
  }
}

/**
 * Which by-area response the "Representing this community" widget is rendering.
 *
 * 🔴 It reads TAGS, not names, and that is the whole design. No script can tell
 * one real person's name from another's — 17-06's first draft concluded from
 * that, wrongly, that Task 1 was uncheckable. The revert being guarded against
 * is a WRONG SOURCE, and a source is observable: `taggedByArea` below answers
 * every by-area POST with a roster whose names encode the geo_id that was asked
 * for, so "the sidebar is rendering the VISITED place's officials" becomes a
 * string comparison with no network in it.
 *
 * Correctness — are these the right people — is NOT this assertion's question
 * and cannot be. That is the human read in 17-07 Task 4.
 *
 * The widget carries no data attribute; it is found by its own heading so that
 * `Sidebar.tsx` stays untouched, which is 17-06's test of whether the hook's
 * signature was right.
 */
function readRepsTags() {
  const h3 = [...document.querySelectorAll('h3')].find((h) =>
    /Representing This Community/i.test(h.textContent || ''),
  )
  const card = h3?.closest('div')
  const text = card ? card.innerText || '' : ''
  return {
    widget: !!h3,
    tags: [...new Set(text.match(/GEOID-[0-9A-Za-z]+/g) || [])].sort(),
  }
}

/** elementFromPoint at a control's centre: does a click actually land on it? */
function hitTest({ sel, selector }) {
  const p = document.querySelector(sel)
  const el = p?.querySelector(selector)
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

/** The frozen fixture bodies, read once. `rows` / `body` are the envelopes 17-03 chose. */
async function readFixtures() {
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const here = dirname(fileURLToPath(import.meta.url))
  const load = async (name) => JSON.parse(await readFile(join(here, 'fixtures', name), 'utf8'))
  const search = await load('place-search-asheville.json')
  const coords = await load('coordinate-lookup-asheville.json')
  return { searchRows: search.rows, coordinateBody: coords.body ?? coords }
}

/**
 * Serve the two place legs from the fixtures.
 *
 * Only these two. Everything else on the page — banners, meetings, elections,
 * Compass topics — reaches the network exactly as it does for the member
 * viewers above, so this viewer is no more and no less network-bound than they
 * are. What is pinned is the RESOLUTION, which is what decides whether the run
 * is about a place at all.
 */
async function stubPlaceLegs(page, fx) {
  await page.route('**/api/essentials/location-search*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx.searchRows) }),
  )
  await page.route('**/api/essentials/coordinate-lookup', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx.coordinateBody) }),
  )
}

/**
 * A by-area roster whose every name says which geo_id was asked for.
 *
 * 🔴 These are ROUTING TAGS, not people, and nothing like them ever reaches the
 * app: this fulfils a route inside one Playwright context. `CLAUDE.md`'s rule is
 * that the APP never invents civic record and never swaps in fixture data when a
 * request fails — `usePlaceRepresentatives` has no fallback at all for exactly
 * that reason. A check that stubs an endpoint to prove which end of a wire is
 * connected is a different thing, and it is the only way to make "the officials
 * came from the visited place" deterministic: the real endpoint's answer is two
 * sets of real names that a script cannot tell apart from each other, let alone
 * tell apart from the wrong ones.
 *
 * `district_type` has to survive `filterRepsByTab` (src/types/representatives.ts)
 * or the widget renders nothing and the assertion is vacuous: LOCAL for City,
 * NATIONAL_LOWER for Federal, COUNTY for County.
 */
function taggedRoster(geoId) {
  const one = (district_type, office_title) => ({
    id: `${geoId}-${district_type}`,
    full_name: `GEOID-${geoId} ${office_title}`,
    office_title,
    photo_origin_url: '',
    district_type,
    government_type: 'CHECK_FIXTURE',
    is_vacant: false,
    is_elected: true,
    images: [],
  })
  return [one('LOCAL', 'Mayor'), one('COUNTY', 'County Commissioner'), one('NATIONAL_LOWER', 'U.S. Representative')]
}

/**
 * Serve every `POST /essentials/browse/by-area` from `taggedRoster`, and record
 * each request's BODY.
 *
 * 🔴 The geoid is in the body, not the query string — by-area is a POST. A
 * network assertion that read URLs alone could not see the single request this
 * whole task is about, which is the mistake 17-05's revert matrix caught in
 * `check-place-entry` and is recorded in 17-VALIDATION.
 */
async function stubByArea(page, log) {
  await page.route('**/api/essentials/browse/by-area', (route) => {
    const body = route.request().postData() ?? ''
    log.push(body)
    let geoId = 'UNKNOWN'
    try {
      geoId = JSON.parse(body).geo_id ?? 'UNKNOWN'
    } catch {
      /* a body we cannot parse is itself worth seeing in the log */
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(taggedRoster(geoId)),
    })
  })
}

/**
 * Type into a picker from empty and wait for the list to answer.
 *
 * 🔴 The fixed wait is not padding: `usePlaceSearch` debounces at 250 ms and the
 * stub answers every query with the same rows, so a run that only waited for
 * `[role="option"]` would be satisfied by the PREVIOUS query's list. Copied from
 * `check-place-entry.mjs`, where that cost a finding.
 */
async function typeInto(page, scope, text) {
  const input = page.locator(`${scope} input[role="combobox"]`)
  await input.click()
  await input.fill('')
  await input.fill(text)
  await page.waitForTimeout(900)
  await page.waitForSelector(`${scope} [role="option"]`, { timeout: 10000 })
}

/**
 * "Not over-gated", as an object, so the three viewers that ask it ask it the
 * same way. A failure here is OVER-gating: another place's Explore reduced to a
 * dead page, which fails D-18 from the other direction. `cs_saved_adventures`
 * and `cs_explore_ui` never touch Supabase, so neither is a write
 * (16-CONTEXT locked decision 4's companion).
 */
async function readNotOverGated(page) {
  await page.locator(`${PANEL} [data-explore-module="nearby"]`).getByRole('button', { name: /See the details/ }).click()
  await page.waitForTimeout(500)
  const saveHit = await page.evaluate(hitTest, { sel: PANEL, selector: 'dialog button[aria-pressed]' })
  const saveState = () => page.evaluate((sel) => {
    const b = document.querySelector(`${sel} dialog button[aria-pressed]`)
    return { pressed: b?.getAttribute('aria-pressed'), label: (b?.textContent || '').trim() }
  }, PANEL)
  await page.locator(`${PANEL} dialog button[aria-pressed]`).click()
  await page.waitForTimeout(400)
  const afterSave = await saveState()
  // Toggled back, so this assertion leaves cs_saved_adventures as it found it.
  await page.locator(`${PANEL} dialog button[aria-pressed]`).click()
  await page.waitForTimeout(400)
  const afterUnsave = await saveState()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  const checkedIndex = () => page.evaluate(
    (sel) => [...document.querySelectorAll(`${sel} [data-explore-module="imagine"] input[type="radio"]`)].findIndex((r) => r.checked),
    PANEL,
  )
  const before = await checkedIndex()
  await page.locator(`${PANEL} [data-explore-module="imagine"] input[type="radio"]`).nth(1).click({ force: true })
  await page.waitForTimeout(400)
  const after = await checkedIndex()

  return {
    saveHit,
    afterSave,
    afterUnsave,
    radio: `${before} -> ${after}`,
    ok:
      saveHit.found &&
      saveHit.ok &&
      afterSave.pressed === 'true' &&
      /^Saved on this device$/.test(afterSave.label) &&
      afterUnsave.pressed === 'false' &&
      /^Save on this device$/.test(afterUnsave.label) &&
      after === 1 &&
      after !== before,
  }
}

// ── The run ──────────────────────────────────────────────────────────────────

const chromium = await loadChromium()
if (!chromium) {
  console.error('Playwright not found locally or globally. It is a GLOBAL install here —')
  console.error('node_modules is the wrong place to look. See CLAUDE.md.')
  process.exit(1)
}

const browser = await chromium.launch()

/** A context booted with the theme already chosen, because the app reads the
 *  cookie before first paint and a later change needs a reload to take. */
async function freshContext(theme, viewport, init) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addCookies([{ name: 'ev_color_scheme', value: theme, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()
  const errors = { page: [], console: [], noise: [] }
  page.on('pageerror', (e) => errors.page.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    ;(EXPECTED_NOISE.some((re) => re.test(t)) ? errors.noise : errors.console).push(t)
  })
  if (init) await page.addInitScript(init.fn, init.arg)
  return { ctx, page, errors }
}

/**
 * Waits for the app to be up and confirms the theme it chose.
 *
 * `ready` differs by viewer: a member waits for the nav rail, and a signed-out
 * visitor has no nav rail at all — waiting for one there times out and reports a
 * theme failure about a page that rendered perfectly.
 */
async function bootedWithTheme(page, theme, ready = 'nav[aria-label="Civic space navigation"]') {
  await page.waitForSelector(ready, { timeout: 25000 })
  await page.waitForTimeout(2500)
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  return isDark === (theme === 'dark')
}

/**
 * Conversations -> the slice pill -> Slice 2 -> back to Explore.
 *
 * 🔴 Returns the FEED's notice, read on the way past. That is the only moment
 * this run is looking at the Conversations panel while view-only, and the feed's
 * notice is the one observable consequence of AppShell's PER-TAB call to
 * whyNoWrite — the active-tab call and the per-tab call are different code, and
 * without this the per-tab one has no browser coverage at all.
 */
async function switchToSibling(page) {
  await page.getByRole('tab', { name: /Conversations/i }).click()
  await page.waitForTimeout(500)
  await page.locator('button[aria-haspopup="listbox"]').first().click()
  await page.waitForTimeout(300)
  await page.locator('[role="option"]').filter({ hasText: 'Slice 2' }).first().click()
  await page.waitForTimeout(800)
  const feedNotice = await page.evaluate(readNotice, { sel: FEED_PANEL })
  await page.getByRole('tab', { name: /Explore/i }).click()
  await page.waitForTimeout(800)
  return feedNotice
}

/** Open the featured topic — the one module EVERY level has, so one path serves both tabs. */
async function openTopic(page, sel = PANEL) {
  await page.locator(`${sel} [data-explore-module="featured"] button`).first().click()
  await page.waitForTimeout(700)
}

async function closeTopic(page, sel = PANEL) {
  await page.locator(sel).getByRole('button', { name: /^Explore$/ }).first().click()
  await page.waitForTimeout(600)
}

const read = (page, sel = PANEL) => page.evaluate(readPanel, { sel, words: WRITE_WORDS })

/**
 * Does this notice name THIS viewer's reason, and no other viewer's?
 *
 * The second half is the one that matters: a component that rendered the
 * sibling-shard sentence to a signed-out visitor would still contain a reason,
 * and "a notice is present" would pass.
 */
function namesReason(notice, expected) {
  if (!notice?.found || !notice.visible) return false
  if (notice.reason !== expected) return false
  const own = REASON_WORDS[expected]
  if (!own?.test(notice.text)) return false
  return !Object.entries(REASON_WORDS).some(([r, re]) => r !== expected && re.test(notice.text))
}

/**
 * The control case. Returns what was actually FOUND, so a failure names the
 * affordance rather than a bare count.
 */
async function controlCase(page, spec) {
  const found = {
    imagineTextarea: false,
    shareIdea: false,
    saveOnDevice: false,
    titleInput: false,
    thoughtsTextarea: false,
    submit: false,
  }

  if (spec.hasImagine) {
    // 🔴 Choose an Imagine option FIRST. Both controls are inside `{option && …}`
    // and the saved default is null, so neither is in the DOM until this click.
    // The choice persists in cs_explore_ui for the rest of the run.
    await page.locator(`${PANEL} [data-explore-module="imagine"] input[type="radio"]`).first().click({ force: true })
    await page.waitForTimeout(500)
    const im = await page.evaluate((sel) => {
      const m = document.querySelector(`${sel} [data-explore-module="imagine"]`)
      return {
        textarea: !!m?.querySelector('textarea'),
        share: /Share an idea|Sign in to share/.test(m?.innerText || ''),
      }
    }, PANEL)
    found.imagineTextarea = im.textarea
    found.shareIdea = im.share

    // 🔴 "Save on this device" is inside a <dialog> and does not exist until opened.
    await page.locator(`${PANEL} [data-explore-module="nearby"]`).getByRole('button', { name: /See the details/ }).click()
    await page.waitForTimeout(500)
    // `Saved?` — assertion 8 toggles this bookmark, and the control case runs again
    // after it. The control case asks whether the keeper EXISTS; which way it is
    // currently toggled is not the question, and matching only the un-saved label
    // would turn a tidy-up into a phantom failure.
    found.saveOnDevice = await page.evaluate(
      (sel) => [...document.querySelectorAll(`${sel} dialog button`)].some((b) => /^Saved? on this device$/.test((b.textContent || '').trim())),
      PANEL,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }

  // Both tabs: a topic's title input, "Your thoughts" textarea and submit.
  await openTopic(page)
  const t = await page.evaluate((sel) => {
    const p = document.querySelector(sel)
    return {
      title: !!p?.querySelector('form input[type="text"]'),
      thoughts: !!p?.querySelector('form textarea'),
      submit: !!p?.querySelector('form button[type="submit"]'),
    }
  }, PANEL)
  found.titleInput = t.title
  found.thoughtsTextarea = t.thoughts
  found.submit = t.submit
  await closeTopic(page)
  return found
}

function controlCaseOk(found, spec) {
  const required = spec.hasImagine
    ? ['imagineTextarea', 'shareIdea', 'saveOnDevice', 'titleInput', 'thoughtsTextarea', 'submit']
    : ['titleInput', 'thoughtsTextarea', 'submit']
  return required.every((k) => found[k])
}

for (const spec of TABS) {
  const { tab } = spec
  console.log(`\n── ${tab.toUpperCase()} ${'─'.repeat(52 - tab.length)}`)

  const { ctx, page, errors } = await freshContext('dark', DESKTOP, {
    fn: (t) => {
      // A clean profile each run. cs_explore_ui is what makes the Imagine radio
      // click meaningful (its default is null), and a leftover open topic would
      // start the run on a topic page instead of the module list.
      localStorage.setItem('cs_active_tab', t)
      for (const k of ['cs_explore_ui', 'cs_explore_drafts_v2', 'cs_explore_resume_v2', 'cs_saved_adventures']) {
        localStorage.removeItem(k)
      }
    },
    arg: tab,
  })

  await page.goto(`${ORIGIN}/?dev=1`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark'))) {
    check(tab, 1, 'the page booted with the requested theme (ev_color_scheme cookie)', false,
      'documentElement.dark does not match the cookie — Playwright colorScheme does nothing here.')
    await ctx.close()
    continue
  }

  // ── 1  The control case, on the member's OWN shard ────────────────────────
  const own = await controlCase(page, spec)
  const presentList = Object.entries(own).filter(([, v]) => v).map(([k]) => k).join(', ') || 'NOTHING'
  check(
    tab,
    1,
    `CONTROL CASE — present on the member's own shard: ${presentList}`,
    controlCaseOk(own, spec),
    `${JSON.stringify(own)}\n            Every assertion below is vacuous without this. A failure AFTER the radio` +
      `\n            click and the dialog open is a real finding — stop and report it. If the` +
      `\n            imagine/nearby entries are false on CITY, either the fixture's City sibling or` +
      `\n            DEFAULT_MODULES.city has changed and four affordances are no longer covered.`,
  )

  // Federal must genuinely LACK the two City-only modules, or `hasImagine: false`
  // is quietly skipping four affordances on a tab that does have them.
  if (!spec.hasImagine) {
    const mods = (await read(page)).modules ?? []
    const wrong = mods.some((m) => m === 'imagine' || m === 'nearby')
    console.log(`  (note) ${tab} renders [${mods.join(', ')}]`)
    console.log(`         imagine/nearby ${wrong ? '🔴 PRESENT — the City-only skip below is WRONG' : 'absent, as expected'}`)
  }

  // ── Switch to the sibling shard ───────────────────────────────────────────
  // The feed's notice is read on the way past, for assertion 13.
  const feedNotice = await switchToSibling(page)

  const list = await read(page)
  const listNotice = await page.evaluate(readNotice, { sel: PANEL })
  await openTopic(page)
  const topic = await read(page)
  const topicNotice = await page.evaluate(readNotice, { sel: PANEL })
  await closeTopic(page)

  const both = (fn) => fn(list) && fn(topic)
  const where = (fn) => `list=${JSON.stringify(fn(list))} topicPage=${JSON.stringify(fn(topic))}`

  // ── 2–5  No write affordance, on the LIST and in an OPEN TOPIC ────────────
  check(tab, 2, 'zero button[type="submit"] — list and topic page (#1)',
    both((v) => v.submits === 0), where((v) => v.submits))
  check(tab, 3,
    `zero textarea — list and topic page (#5${spec.hasImagine ? ', and #6: the Imagine textarea is on the list here' : ''})`,
    both((v) => v.textareas === 0), where((v) => v.textareas))
  check(tab, 4, 'zero free-text input, radios and checkboxes excluded — list and topic page (#4)',
    both((v) => v.freeTextInputs === 0), where((v) => v.freeTextInputs))
  check(tab, 5, 'no write wording — list and topic page (#1, #2, #7, #8)',
    both((v) => v.writeWord === null), where((v) => v.writeWord))

  // ── 6  The notice, in BOTH views ──────────────────────────────────────────
  check(tab, 6, 'the view-only notice is present — list and topic page',
    both((v) => v.notice === true), `${where((v) => v.notice)}` +
      '\n            Without it the member is read-only with nothing on screen saying why.')

  // ── 7  The notice's control is HIT-TESTABLE, at both viewports and themes ─
  //
  // PR #92 shipped a credit link that rendered perfectly and could not be clicked:
  // it sat under a padded layer at the wrong z-index, at md and up only, so phones
  // looked fine and every screenshot passed. Rendering is not reachability.
  {
    const results = []
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => {
        document.cookie = `ev_color_scheme=${t}; path=/; max-age=31536000; SameSite=Lax`
        document.documentElement.classList.toggle('dark', t === 'dark')
      }, theme)
      // 🔴 Asserted, not assumed. Playwright's colorScheme would have changed nothing.
      const classOk = await page.evaluate((t) => document.documentElement.classList.contains('dark') === (t === 'dark'), theme)
      for (const vp of [DESKTOP, MOBILE]) {
        await page.setViewportSize(vp)
        await page.waitForTimeout(400)
        await page.evaluate((sel) => document.querySelector(`${sel} [data-explore-view-only-notice]`)?.scrollIntoView({ block: 'center' }), PANEL)
        await page.waitForTimeout(250)
        const r = await page.evaluate(hitTest, { sel: PANEL, selector: '[data-explore-view-only-notice] button' })
        results.push({ theme, w: vp.width, classOk, ...r })
      }
    }
    await page.setViewportSize(DESKTOP)
    await page.evaluate(() => {
      document.cookie = 'ev_color_scheme=dark; path=/; max-age=31536000; SameSite=Lax'
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)
    check(
      tab, 7,
      'the Switch-back control hit-tests to itself — 2 themes x 2 viewports',
      results.every((r) => r.classOk && r.found && r.ok),
      results.map((r) => `${r.theme}/${r.w}px: themeApplied=${r.classOk} found=${r.found} clickLands=${r.ok} blockedBy=${r.blockedBy ?? r.why ?? '-'}`).join('\n            '),
    )
  }

  // ── 8  Not over-gated: the device-local controls still work (City only) ───
  if (spec.hasImagine) {
    // 🔴 One helper, three viewers. 17-06 needed this same block at a VISITED
    // place; a second copy of it is how two readers of one rule drift apart.
    const gated = await readNotOverGated(page)
    check(
      tab, 8,
      'NOT over-gated: "Save on this device" is clickable and toggles both ways, and the Imagine radios still select',
      gated.ok,
      JSON.stringify(gated) +
        `\n            A failure here is OVER-gating: another shard's Explore reduced to a dead page,` +
        `\n            which fails goal 6 from the other direction. cs_saved_adventures and` +
        `\n            cs_explore_ui never touch Supabase, so neither is a write.`,
    )
  } else {
    // Stated, never silent: a SKIP is not a pass.
    console.log('  SKIP  8  "Save on this device" / Imagine radios — City/County only, by composition')
  }

  // ── 9  Switch back: the escape hatch is real ──────────────────────────────
  //
  // 🔴 Guarded, so a MISSING control reports red here and the remaining assertions
  // still run. An unguarded click throws on a locator timeout, which aborts the
  // whole tab — and a crashed run tells you less than a failed one.
  let clicked = true
  try {
    await page.locator(`${PANEL} [data-explore-view-only-notice] button`).click({ timeout: 5000 })
  } catch {
    clicked = false
  }
  await page.waitForTimeout(900)
  const backHome = clicked ? await read(page) : { notice: 'no switch-back control to click' }
  const ownAgain = clicked ? await controlCase(page, spec) : {}
  check(
    tab, 9,
    'Switch back leaves view-only and the control case holds again',
    clicked && backHome.notice === false && controlCaseOk(ownAgain, spec),
    `clicked=${clicked} notice=${backHome.notice} ${JSON.stringify(ownAgain)}` +
      '\n            A notice whose control does not undo view-only is decorative, and the member is' +
      '\n            stranded: Explore renders no shard selector of its own.',
  )

  await ctx.close()

  // Read inside assertion 10's context below, asserted as 14 after it closes.
  let deepRead = { replyOnScreen: false, replyButtons: -1, threadTextareas: -1, threadSubmits: -1 }

  // ── 10  The resume invariant, via a deep link ─────────────────────────────
  //
  // 🔴 NOT "set a marker and reload while view-only". viewingSlices is plain
  // useState and is not persisted, so a reload CLEARS view-only and that
  // procedure describes a state that cannot exist. The reachable version is the
  // deep link, where openPost sets view-only only after `await locatePost(...)`
  // — a race, not an ordering guarantee. What it checks is the invariant.
  //
  // The decision table itself is unreachable from a browser and is covered by
  // shouldResume, scripts/check-composition.mjs 48–55.
  {
    const { ctx: c2, page: p2, errors: e2 } = await freshContext('dark', DESKTOP, {
      fn: ({ key, resume }) => {
        const at = Date.now()
        localStorage.setItem('cs_explore_resume_v2', JSON.stringify({ ...resume, at }))
        localStorage.setItem(
          'cs_explore_drafts_v2',
          JSON.stringify({ [key]: { title: 'Resume marker planted by check:explore-gate', body: 'x', updatedAt: at } }),
        )
      },
      arg: { key: spec.draftKey, resume: spec.resume },
    })
    await p2.goto(`${ORIGIN}/post/${spec.siblingPostId}?dev=1`, { waitUntil: 'domcontentloaded' })
    await bootedWithTheme(p2, 'dark')
    await p2.waitForTimeout(3500)

    const deep = await p2.evaluate(({ postId, replyText }) => {
      const body = document.body.innerText || ''
      const pill = [...document.querySelectorAll('button[aria-haspopup="listbox"]')]
        .map((b) => (b.textContent || '').trim())
        .join(' | ')
      return {
        path: location.pathname,
        // The link really resolved: still on the post route, not bounced to '/'.
        onPostRoute: location.pathname === `/post/${postId}`,
        activeTab: localStorage.getItem('cs_active_tab'),
        onSibling: /Slice 2 · View Only/.test(pill),
        readOnlyNotice: /read-only/i.test(body),
        pill,
        // PostComposer is a sheet and is unmounted when closed.
        composerOpen: /New Post/.test(body) || /Edit anything before you post/.test(body),
        // ── For assertion 14: the REPLY level of the same thread ────────────
        // Visible only — the feed list is CSS-hidden behind an open thread, so
        // anything still laid out belongs to the thread.
        replyOnScreen: body.includes(replyText),
        replyButtons: [...document.querySelectorAll('button')]
          .filter((b) => b.offsetParent !== null && (b.textContent || '').trim() === 'Reply').length,
        threadTextareas: [...document.querySelectorAll('textarea')].filter((t) => t.offsetParent !== null).length,
        threadSubmits: [...document.querySelectorAll('button[type="submit"]')].filter((t) => t.offsetParent !== null).length,
      }
    }, { postId: spec.siblingPostId, replyText: spec.siblingReplyText })

    // 🔴 THE PRECONDITION FIRST. Without it a getMockPostById miss makes locatePost
    // return `unavailable`, the app toasts and navigates to '/', and the composer
    // check below passes on the home feed having tested nothing. Same vacuous shape
    // as the control case, and easier to miss because the toast scrolls away.
    const linkWorked = deep.onPostRoute && deep.onSibling && deep.readOnlyNotice && deep.activeTab === spec.tab
    // Both outcomes are acceptable: no composer at all, or a composer with the pill
    // on the member's OWN shard (AppShell's setViewingSlices reset doing its job).
    // A composer open while the pill says Slice 2 is the bug.
    const invariant = !deep.composerOpen || !deep.onSibling

    check(
      tab, 10,
      'deep link opens the sibling post view-only, and NO composer is open there',
      linkWorked && invariant,
      JSON.stringify(deep) +
        (linkWorked
          ? '\n            The link resolved, so this is the real thing: a composer is open while the' +
            "\n            pill shows Slice 2. handleStartConversation's activeIsViewOnly refusal, or" +
            '\n            the setViewingSlices reset behind it, has gone.'
          : '\n            🔴 THE LINK DID NOT RESOLVE, so the composer check tested nothing. Look at' +
            '\n            getMockPostById in src/lib/devMockData.ts FIRST — it hard-codes its array' +
            '\n            list, so a post registered only in MOCK_FEEDS is invisible to it. Then' +
            '\n            check the sibling id is prefixed by MOCK_SLICES.<type>.id, which is what' +
            '\n            useNotificationRouting matches on.'),
    )

    deepRead = deep
    errors.page.push(...e2.page)
    errors.console.push(...e2.console)
    errors.noise.push(...e2.noise)
    await c2.close()
  }

  // ── 11  Errors ────────────────────────────────────────────────────────────
  if (errors.noise.length) {
    console.log(
      `  (noise) ${errors.noise.length} expected dev-id network errors suppressed: ` +
        [...new Set(errors.noise)].map((t) => t.slice(0, 64)).join(' | '),
    )
  }
  check(
    tab, 11,
    'zero uncaught page errors and zero unexpected console errors throughout',
    errors.page.length === 0 && errors.console.length === 0,
    [...errors.page, ...errors.console].slice(0, 3).join('\n            ') +
      '\n            A thrown render is not a gate: an exception while hiding a control can leave' +
      '\n            the control on screen.',
  )

  // ── 12  The Explore notice NAMES this viewer's reason ─────────────────────
  //
  // Numbered after 11 rather than beside 6 so Phase 16's numbering is untouched
  // and a regression in it still reads as one. Read before ctx.close() above.
  check(
    tab, 12,
    "the Explore notice names the sibling-shard reason — list and topic page",
    namesReason(listNotice, 'sibling-shard') && namesReason(topicNotice, 'sibling-shard'),
    `list=${JSON.stringify(listNotice)}\n            topicPage=${JSON.stringify(topicNotice)}` +
      '\n            A notice that is present but names nothing is a surface that was told it is' +
      '\n            gated and not told why — ReadOnlyNotice renders `unknown` in that case.',
  )

  // ── 13  The FEED notice names it too — the per-tab call site's only coverage ─
  //
  // 🔴 This is the one assertion that reaches AppShell's PER-TAB whyNoWrite call
  // (the FEED_TABS map). check:write-access exercises the function and never a
  // call site, and 17-04 guards the whole feed map off while visiting a place, so
  // no later visited-place run renders a feed panel at all. Revert that call site
  // to the old `!!viewing && viewing.id !== slice.id` and this goes red while
  // everything else stays green: a boolean computes no reason to show.
  check(
    tab, 13,
    'the FEED notice names the sibling-shard reason too — the per-tab call site',
    namesReason(feedNotice, 'sibling-shard'),
    JSON.stringify(feedNotice) +
      '\n            The feed panel computes its own answer for its own tab. If this is the only' +
      '\n            red, look at the FEED_TABS map in AppShell, not at the gate.',
  )

  // ── 14  The THREAD's reply level, in the same deep-linked thread ──────────
  //
  // 🔴 This row of the plan's revert matrix was supposed to be covered by
  // assertion 10 and was NOT. Reverting ThreadView's
  // `canWrite={canWrite && !isViewOnly}` to `canWrite` left all 36 assertions
  // green, for two compounding reasons: ReplyCard renders its Reply button only
  // when canWrite AND onReply both survive, so reverting either ALONE changes
  // nothing — and the two sibling posts had zero replies, so no ReplyCard
  // mounted at all and neither did reverting BOTH. Assertion 10 only ever looked
  // at the POST composer. The fixtures now carry a reply each, and this reads it.
  check(
    tab, 14,
    'the view-only thread shows a REPLY and offers no reply control on it',
    deepRead.replyOnScreen &&
      deepRead.replyButtons === 0 &&
      deepRead.threadTextareas === 0 &&
      deepRead.threadSubmits === 0,
    JSON.stringify(deepRead) +
      '\n            replyOnScreen false is the VACUOUS case, not a gate failure: no ReplyCard' +
      '\n            mounted, so the three zeroes beside it are statements about nothing. Look' +
      '\n            at MOCK_REPLIES in devMockData.ts first. Any other red is the gate itself:' +
      '\n            ThreadView passes canWrite={canWrite && !isViewOnly} AND no onReply, and' +
      '\n            ReplyCard needs both.',
  )
}

// ── Viewer: signed out, looking at a place they named = `observer-with-a-place`
//
// 🔴 RE-POINTED BY 17-04. 17-02 wrote this viewer against the `geoid: null`
// Explore a stranger used to be given above a "Log in to view your civic
// community" strip. 17-04 deleted that screen (D-09) and replaced it with the
// welcome screen, so the viewer now WALKS: boot signed out, assert the welcome
// screen, name a place through the picker, and run the same absence assertions
// against that place's real Explore.
//
// 🔴 THE CONTROL CASE HERE IS INVERTED, and that has to be stated rather than
// skipped. There is no shard to switch back from, so "the affordances are
// present first" cannot be it. Three things make this run non-vacuous instead:
//   1. The welcome screen rendered, the place RESOLVED, and the hero banner
//      names it. 🔴 This is the half 17-04 added, and it is now the likeliest
//      way the viewer goes quietly vacuous: a run where the place never
//      resolved has no textareas either, and would pass 2–5 having tested a
//      welcome screen.
//   2. Explore is on screen and rendered MODULES. Without that, every "zero
//      textareas" below is a true statement about a blank page.
//   3. The notice is present and names the signed-out reason. A gate with no
//      explanation strands the visitor, and a missing notice is the shape that
//      says the gate was applied to a component that never mounted.
async function runSignedOut(fx) {
  const tab = 'signed-out'
  console.log(`\n── OBSERVER WITH A PLACE — SIGNED OUT ${'─'.repeat(18)}`)

  const { ctx, page, errors } = await freshContext('dark', DESKTOP, {
    fn: () => {
      for (const k of ['cs_explore_ui', 'cs_explore_drafts_v2', 'cs_explore_resume_v2', 'cs_saved_adventures']) {
        localStorage.removeItem(k)
      }
      // 🔴 Cleared, not set: the picker lands on the place's most local tab and
      // AppShell deliberately never WRITES this key while visiting. A leftover
      // value here would be ignored, and a reader who assumed otherwise would
      // be chasing the wrong thing when the banner names the wrong level.
      localStorage.removeItem('cs_active_tab')
      try { sessionStorage.removeItem('cs_viewed_place') } catch { /* blocked */ }
    },
  })
  await stubPlaceLegs(page, fx)

  await page.goto(`${ORIGIN}/?signedout=1`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark', WELCOME))) {
    check(tab, 1, 'the page booted with the requested theme (ev_color_scheme cookie)', false,
      'documentElement.dark does not match the cookie, or the welcome screen never mounted.')
    await ctx.close()
    return
  }

  // ── Name a place, the way a visitor does ──────────────────────────────────
  const walked = { welcome: true, options: 0, resolved: false, heroName: null }
  try {
    await page.locator(`${PICKER} input[role="combobox"]`).click()
    await page.keyboard.type(PLACE_QUERY)
    await page.waitForSelector(`${PICKER} [role="option"]`, { timeout: 10000 })
    walked.options = await page.locator(`${PICKER} [role="option"]`).count()
    await page.locator(`${PICKER} [role="option"]`).first().click()
    await page.waitForSelector(PANEL, { timeout: 20000 })
    await page.waitForTimeout(2500)
    walked.resolved = true
  } catch (err) {
    walked.error = String(err).split('\n')[0]
  }
  walked.heroName = await page.evaluate(() => document.querySelector('h2')?.innerText?.trim() ?? null)

  /**
   * 🔴 If the walk did not land on the place, STOP — loudly, and without
   * crashing.
   *
   * Found by this plan's own revert matrix: breaking the coordinate-lookup stub
   * leaves the viewer on the welcome screen, and the absence assertions below
   * then threw on a locator timeout and took the whole run with them. A crashed
   * run tells you less than a failed one (the same argument assertion 9 above
   * already makes), and it hides the member viewers that ran fine before it.
   *
   * A SKIP is not a pass, so it says exactly what was not checked.
   */
  if (!walked.resolved || walked.heroName !== PLACE_NAME) {
    check(
      tab, 1,
      `CONTROL CASE (inverted) — "${PLACE_QUERY}" did NOT resolve to a place on screen`,
      false,
      `walk=${JSON.stringify(walked)}` +
        '\n            The viewer is still on the welcome screen. Look at walk.error, then at the two' +
        '\n            route stubs: a chosen row answers city and state, and resolveChosenPlace throws' +
        '\n            no-county without the coordinate-lookup leg. If walk.options is 0 the search' +
        '\n            stub did not match the request; if it is >0 the second leg is the one.',
    )
    console.log('  SKIP 2-7  the absence assertions — NOT CHECKED, and not meaningful here: the welcome')
    console.log('            screen has no submits, textareas or inputs either, so every one of them')
    console.log('            would be a true statement about the wrong page.')
    await ctx.close()
    check(
      tab, 11,
      'zero uncaught page errors and zero unexpected console errors throughout',
      errors.page.length === 0 && errors.console.length === 0,
      [...errors.page, ...errors.console].slice(0, 3).join('\n            '),
    )
    return
  }

  // 🔴 Choose an Imagine option FIRST, exactly as the member control case does.
  // The Imagine textarea (#6) and "Sign in to share" (#2) live inside
  // `{option && …}` and the saved default is null, so WITHOUT this click
  // assertions 3 and 5 below are true of a page that never had them — vacuous
  // for precisely the two affordances a signed-out visitor used to be offered.
  // The radios themselves are a view preference and are NOT gated (see the
  // member run's assertion 8), so the click must still land.
  await page.locator(`${PANEL} [data-explore-module="imagine"] input[type="radio"]`)
    .first().click({ force: true }).catch(() => {})
  await page.waitForTimeout(500)
  const radioChecked = await page.evaluate(
    (sel) => [...document.querySelectorAll(`${sel} [data-explore-module="imagine"] input[type="radio"]`)].some((r) => r.checked),
    PANEL,
  )

  const list = await read(page, PANEL)
  const listNotice = await page.evaluate(readNotice, { sel: PANEL })
  await openTopic(page, PANEL)
  const topic = await read(page, PANEL)
  const topicNotice = await page.evaluate(readNotice, { sel: PANEL })
  await closeTopic(page, PANEL)

  const both = (fn) => fn(list) && fn(topic)
  const where = (fn) => `list=${JSON.stringify(fn(list))} topicPage=${JSON.stringify(fn(topic))}`

  // ── 1  The inverted control case ──────────────────────────────────────────
  check(
    tab, 1,
    `CONTROL CASE (inverted) — the welcome screen rendered, "${PLACE_QUERY}" resolved to a banner reading ` +
      `"${walked.heroName}", and Explore is on screen with modules: ${(list.modules ?? []).join(', ') || 'NONE'}, ` +
      'with an Imagine option chosen',
    walked.resolved &&
      walked.heroName === PLACE_NAME &&
      Array.isArray(list.modules) &&
      list.modules.length > 0 &&
      radioChecked,
    `walk=${JSON.stringify(walked)}\n            panel=${JSON.stringify(list)}` +
      `\n            radioChecked=${radioChecked}` +
      '\n            Every absence below is vacuous without this, and in TWO ways now. If the place' +
      '\n            never resolved, the viewer is still on the welcome screen — which has no' +
      '\n            textareas either, so 2-5 would pass having tested nothing. Look at walk.error' +
      '\n            and at the coordinate-lookup stub FIRST: a chosen row answers city and state,' +
      '\n            and resolveChosenPlace throws no-county without the second leg. If the place' +
      '\n            DID resolve, the remaining risk is the Imagine option that REVEALS a textarea' +
      '\n            and "Sign in to share" never being chosen.',
  )

  // ── 2–5  No write affordance, on the LIST and in an OPEN TOPIC ────────────
  check(tab, 2, 'zero button[type="submit"] — list and topic page (#1)',
    both((v) => v.submits === 0), where((v) => v.submits))
  check(tab, 3, 'zero textarea — list and topic page (#5, #6)',
    both((v) => v.textareas === 0), where((v) => v.textareas))
  check(tab, 4, 'zero free-text input, radios and checkboxes excluded — list and topic page (#4)',
    both((v) => v.freeTextInputs === 0), where((v) => v.freeTextInputs))
  check(tab, 5, 'no write wording — list and topic page (#1, #2, #7, #8)',
    both((v) => v.writeWord === null), where((v) => v.writeWord) +
      '\n            "Sign in to share" and "Sign in to join the conversation" were BOTH offered to' +
      '\n            a signed-out visitor before Phase 17, and both are in WRITE_WORDS.')

  // ── 6  The inverted control case, part two: the notice names the reason ───
  check(
    tab, 6,
    'the notice names the signed-out reason and offers sign-in — list and topic page',
    namesReason(listNotice, 'signed-out') &&
      namesReason(topicNotice, 'signed-out') &&
      !!listNotice.link,
    `list=${JSON.stringify(listNotice)}\n            topicPage=${JSON.stringify(topicNotice)}` +
      '\n            The copy must name BOTH walls — an account AND an address set — because an' +
      '\n            Inform account passes sign-in and lands on the no-jurisdiction state.',
  )

  // ── 7  The sign-in control is HIT-TESTABLE, at both viewports and themes ──
  {
    const results = []
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => {
        document.cookie = `ev_color_scheme=${t}; path=/; max-age=31536000; SameSite=Lax`
        document.documentElement.classList.toggle('dark', t === 'dark')
      }, theme)
      const classOk = await page.evaluate((t) => document.documentElement.classList.contains('dark') === (t === 'dark'), theme)
      for (const vp of [DESKTOP, MOBILE]) {
        await page.setViewportSize(vp)
        await page.waitForTimeout(400)
        await page.evaluate((sel) => document.querySelector(`${sel} [data-read-only-notice]`)?.scrollIntoView({ block: 'center' }), PANEL)
        await page.waitForTimeout(250)
        const r = await page.evaluate(hitTest, { sel: PANEL, selector: '[data-read-only-notice] a' })
        results.push({ theme, w: vp.width, classOk, ...r })
      }
    }
    await page.setViewportSize(DESKTOP)
    check(
      tab, 7,
      'the Sign in control hit-tests to itself — 2 themes x 2 viewports',
      results.every((r) => r.classOk && r.found && r.ok),
      results.map((r) => `${r.theme}/${r.w}px: themeApplied=${r.classOk} found=${r.found} clickLands=${r.ok} blockedBy=${r.blockedBy ?? r.why ?? '-'}`).join('\n            ') +
        '\n            A gate whose only way on cannot be clicked strands the visitor it informs.',
    )
  }

  // ── 8  The seed invitation is ABSENT ──────────────────────────────────────
  //
  // 🔴 This is 17-06 Task 2's assertion, and it has to be made on a place that
  // is GENUINELY unseeded or it says nothing. Asheville is: it has zero
  // meetings, so no bespoke layer, so `composition.isUnseeded` — which is also
  // why `check:explore-rooms` runs its whole invitation suite there. At 15
  // slice rows in the entire product the unseeded place is the COMMON case
  // (research Q3.3), so this module WOULD be the second one in the list.
  //
  // The invitation invites a VOTE (16-CONTEXT locked decision 6). D-11: an
  // observer is never offered an action they cannot take.
  check(
    tab, 8,
    'the seed invitation does NOT open for an observer, on a genuinely unseeded place',
    Array.isArray(list.modules) && !list.modules.includes('seed-invitation'),
    `modules=${JSON.stringify(list.modules)}` +
      '\n            If `seed-invitation` is in that list, registry.tsx lost the isAuthenticated /' +
      '\n            !isViewOnly terms from its available(). If NO module is unseeded-only in it at' +
      '\n            all, check Asheville is still unseeded — a composition change would make this' +
      '\n            a true statement about a module that was never going to render.',
  )

  // ── 9  NOT over-gated, at a visited place ─────────────────────────────────
  //
  // 🔴 A dead page fails D-18 from the other direction: observation is the
  // expected default, for everyone, so another place's Explore has to still
  // WORK. City/County only, by composition — Asheville's picker landing is City.
  if ((list.modules ?? []).includes('nearby')) {
    const gated = await readNotOverGated(page)
    check(
      tab, 9,
      'NOT over-gated at a visited place: "Save on this device" toggles both ways and the Imagine radios still select',
      gated.ok,
      JSON.stringify(gated) +
        '\n            Over-gating is the failure here, not under-gating. Device-local preferences' +
        '\n            never touch Supabase and are not writes.',
    )
  } else {
    console.log('  SKIP  9  NOT over-gated — the nearby module is not on this tab; City/County only')
  }

  // ── 10  D-10: the page does not address the visitor as a resident ─────────
  //
  // 🔴 `deferred-items.md` item 2, which had NOTHING watching it: with Asheville
  // on screen a visitor was told "Welcome to YOUR Civic Space / Discover what's
  // happening in YOUR community / None of YOURS has one published yet". Read
  // across the LIST and the TOPIC PAGE, because the topic page carries its own
  // copy ("agendas were found for your area").
  {
    const listText = await page.evaluate((sel) => document.querySelector(sel)?.innerText ?? '', PANEL)
    await openTopic(page, PANEL)
    const topicText = await page.evaluate((sel) => document.querySelector(sel)?.innerText ?? '', PANEL)
    await closeTopic(page, PANEL)
    const hits = [listText, topicText].map((t) => CLAIMS_THE_PLACE.exec(t)?.[0] ?? null)
    check(
      tab, 10,
      "D-10: no Explore chrome tells the visitor the place is theirs — list and topic page",
      hits.every((h) => h === null),
      `list=${JSON.stringify(hits[0])} topicPage=${JSON.stringify(hits[1])}` +
        '\n            D-10: never show someone a place as if it were already theirs. The fix is' +
        '\n            ctx.isOwnPlace in the module, or a sentence rewritten true of both readers' +
        '\n            where the string is a static emptyState. 🔴 The generic TOPIC QUESTIONS' +
        '\n            ("What should get built in your city, and where?") are deliberately NOT in' +
        '\n            CLAIMS_THE_PLACE — they are deferred item 3, not a pass. Do not widen the' +
        '\n            regex before fixing them: a check that is red on purpose is one nobody reads.',
    )
  }

  await ctx.close()

  // ── 11  Errors ────────────────────────────────────────────────────────────
  //
  // 🔴 A signed-out boot makes DIFFERENT noise from the dev id's: with no
  // cs_token the member-only endpoints are never called, so some allowlisted
  // 401s simply do not appear. An entry that never matches is fine; an
  // unexpected error is not.
  if (errors.noise.length) {
    console.log(
      `  (noise) ${errors.noise.length} expected network errors suppressed: ` +
        [...new Set(errors.noise)].map((t) => t.slice(0, 64)).join(' | '),
    )
  }
  check(
    tab, 11,
    'zero uncaught page errors and zero unexpected console errors throughout',
    errors.page.length === 0 && errors.console.length === 0,
    [...errors.page, ...errors.console].slice(0, 3).join('\n            ') +
      '\n            A thrown render is not a gate: an exception while hiding a control can leave' +
      '\n            the control on screen.',
  )
}

// ── Viewer: a member with no slice at a level ────────────────────────────────
//
// `?dev=1&place=arden` is an unincorporated address: Buncombe County, North
// Carolina, no incorporated place, so there is no City slice at all. The control
// case is positive and strong, and it runs on a tab the member DOES hold.
async function runMemberNoSlice() {
  const tab = 'member-no-slice'
  console.log(`\n── MEMBER, NO SLICE AT A LEVEL ${'─'.repeat(25)}`)

  const { ctx, page, errors } = await freshContext('dark', DESKTOP, {
    fn: () => {
      // 🔴 cs_active_tab is set to CITY on purpose: the member holds no city
      // slice, so this is the nearest a browser can get to the no-slice
      // presentation. See the SKIP below for what happens next.
      localStorage.setItem('cs_active_tab', 'city')
      for (const k of ['cs_explore_ui', 'cs_explore_drafts_v2', 'cs_explore_resume_v2', 'cs_saved_adventures']) {
        localStorage.removeItem(k)
      }
    },
  })

  await page.goto(`${ORIGIN}/?dev=1&place=arden`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark'))) {
    check(tab, 1, 'the page booted with the requested theme (ev_color_scheme cookie)', false,
      'documentElement.dark does not match the cookie.')
    await ctx.close()
    return
  }

  // ── 1  CONTROL CASE: the County tab, which the member DOES hold, is writable
  await openTopic(page)
  const form = await page.evaluate((sel) => {
    const p = document.querySelector(sel)
    return {
      title: !!p?.querySelector('form input[type="text"]'),
      thoughts: !!p?.querySelector('form textarea'),
      submit: !!p?.querySelector('form button[type="submit"]'),
    }
  }, PANEL)
  await closeTopic(page)
  check(
    tab, 1,
    'CONTROL CASE — the County tab IS writable: title input, "Your thoughts" textarea and submit',
    form.title && form.thoughts && form.submit,
    JSON.stringify(form) +
      '\n            Without this the absences below are vacuous, and worse: the fixture would be' +
      '\n            over-gated — four tabs with nothing writable is not what an unincorporated' +
      '\n            member gets.',
  )

  // ── 2  City is not in the navigation at all ───────────────────────────────
  //
  // Asserted as an exact list, not as "no City": a reader that returned [] would
  // pass "no City" having found nothing at all. The rail labels City and County
  // with their RESOLVED names (GeoNavItem -> useJurisdictionName), so the rail is
  // checked by count and the mobile bar — which uses the generic labels — by name.
  const nav = await page.evaluate(() => {
    const rail = document.querySelector('nav[aria-label="Civic space navigation"]')
    const label = rail && [...rail.querySelectorAll('*')].find((el) => (el.textContent || '').trim() === 'Your Civic Spaces')
    const group = label?.parentElement
    const bar = document.querySelector('nav[aria-label="Slice tabs"]')
    return {
      rail: group ? [...group.querySelectorAll(':scope > button')].map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()) : null,
      bar: bar ? [...bar.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()) : null,
    }
  })
  const barGeo = (nav.bar ?? []).map((t) => t.split(/\d|\s/)[0])
  check(
    tab, 2,
    'City is absent from BOTH navigations — four civic spaces, not five',
    nav.rail?.length === 4 &&
      !nav.rail.some((t) => /Asheville/.test(t)) &&
      barGeo.length === 5 &&
      barGeo.slice(0, 4).join(',') === 'County,State,Federal,Unified' &&
      !barGeo.includes('City'),
    JSON.stringify(nav) +
      '\n            This is the SHIPPED behaviour for an unincorporated member (NavSidebar and' +
      '\n            SliceTabBar both filter on !!slices[tab]) and it is what makes the no-slice' +
      '\n            branch rare rather than broken.',
  )

  // ── 3  SKIP, loudly: the no-slice PRESENTATION is unreachable ─────────────
  //
  // 🔴 A SKIP is not a pass, and it says what was not checked (16-VALIDATION).
  //
  // cs_active_tab was set to 'city' above, and the app moved off it: AppShell has
  // a shipped effect — "Keep the active tab on a slice the member actually has" —
  // that re-points activeTab to the first available whenever slices[activeTab] is
  // missing. So for a SIGNED-IN member who holds any slice, the no-slice Explore
  // branch cannot be held on screen long enough to assert about. The predicate
  // itself is covered by check:write-access 4 and 5, and the branch's value here
  // is that it now fails CLOSED if that effect is ever removed or raced.
  const landedOn = await page.evaluate(() => localStorage.getItem('cs_active_tab'))
  console.log(`  SKIP  3  assertions 2-5 on a tab with no slice — NOT CHECKED, and not reachable:`)
  console.log(`           cs_active_tab was planted as 'city' and the app moved to '${landedOn}'.`)
  console.log("           AppShell's \"keep the active tab on a slice the member actually has\" effect")
  console.log('           re-points it, so the no-slice Explore branch cannot be held on screen.')
  console.log('           The reason itself is covered by check:write-access 4 and 5.')

  await ctx.close()

  // ── 11  Errors ────────────────────────────────────────────────────────────
  if (errors.noise.length) {
    console.log(
      `  (noise) ${errors.noise.length} expected dev-id network errors suppressed: ` +
        [...new Set(errors.noise)].map((t) => t.slice(0, 64)).join(' | '),
    )
  }
  check(
    tab, 11,
    'zero uncaught page errors and zero unexpected console errors throughout',
    errors.page.length === 0 && errors.console.length === 0,
    [...errors.page, ...errors.console].slice(0, 3).join('\n            ') +
      '\n            A thrown render is not a gate.',
  )
}

// ── Viewer: a signed-in member looking at another city ───────────────────────
//
// 17-06's one genuinely NEW viewer. The member starts on their own spaces —
// where the control case is positive and strong — and then enters Asheville
// through the shell's place strip (D-19's second entry point, 17-05).
//
// 🔴 FROM BLOOMINGTON, INDIANA, and not from the Asheville fixture. Assertion
// 14 compares the officials before the trip with the officials after it;
// visiting Asheville FROM Asheville would compare a set against itself and pass
// no matter what, which is the vacuous shape this whole script exists to expose.
// Both gazetteer shards are committed, so both place names resolve offline.
//
// 🔴 This is the only viewer where the two REPS SOURCES differ at all. An
// observer has no `userId`, so `useRepresentatives` is disabled for them and
// there is nothing for `usePlaceRepresentatives` to be confused with.
async function runMemberOtherPlace(fx) {
  const tab = 'member-other-place'
  console.log(`\n── MEMBER, VISITING ANOTHER PLACE ${'─'.repeat(22)}`)

  const { ctx, page, errors } = await freshContext('dark', DESKTOP, {
    fn: () => {
      // 🔴 PLANTED as 'city', never cleared, and assertion 15 is about this key.
      // Cleared, the shell opens on 'federal' (AppShell's default) and the
      // "cs_active_tab is unmoved while visiting" assertion would be comparing
      // two values the member never chose.
      try { localStorage.setItem('cs_active_tab', 'city') } catch { /* blocked */ }
      for (const k of ['cs_explore_ui', 'cs_explore_drafts_v2', 'cs_explore_resume_v2', 'cs_saved_adventures']) {
        try { localStorage.removeItem(k) } catch { /* blocked */ }
      }
    },
  })
  await stubPlaceLegs(page, fx)
  const byAreaBodies = []
  await stubByArea(page, byAreaBodies)

  await page.goto(`${ORIGIN}/?dev=1&place=bloomington`, { waitUntil: 'domcontentloaded' })
  if (!(await bootedWithTheme(page, 'dark'))) {
    check(tab, 1, 'the page booted with the requested theme (ev_color_scheme cookie)', false,
      'documentElement.dark does not match the cookie, or the member shell never mounted.')
    await ctx.close()
    return
  }

  // ── 1  CONTROL CASE, on the member's OWN spaces, before the trip ──────────
  //
  // 🔴 Positive and strong here, unlike the observer's. The Imagine textarea and
  // "Share an idea" live inside `{option && …}` with a persisted default of
  // null, so `controlCase` clicks a radio FIRST — delete that click and this
  // fails on the first run in a perfectly ungated build.
  const spec = { hasImagine: true }
  const own = await controlCase(page, spec)
  const ownTags = await page.evaluate(readRepsTags)
  const ownTab = await page.evaluate(() => { try { return localStorage.getItem('cs_active_tab') } catch { return 'blocked' } })
  const ownHero = await page.evaluate(() => document.querySelector('h2')?.innerText?.trim() ?? null)
  const presentList = Object.entries(own).filter(([, v]) => v).map(([k]) => k).join(', ') || 'NOTHING'
  const controlOk = controlCaseOk(own, spec) && ownHero === 'Bloomington' && ownTags.tags.length > 0
  check(
    tab, 1,
    `CONTROL CASE — on the member's OWN spaces: banner "${ownHero}", officials ${ownTags.tags.join(', ') || 'NONE'}, ` +
      `and present: ${presentList}`,
    controlOk,
    `${JSON.stringify(own)} hero=${ownHero} reps=${JSON.stringify(ownTags)} cs_active_tab=${ownTab}` +
      '\n            Every absence below is vacuous without this, and so is assertion 14: if no' +
      '\n            officials rendered BEFORE the trip, "they changed" is a statement about an' +
      '\n            empty set. A missing reps widget means the by-area stub did not match, or' +
      '\n            filterRepsByTab rejected every tagged row on this tab.',
  )
  if (!controlOk) {
    console.log('  SKIP 2-15  NOT CHECKED — the run never started on the member\'s own writable spaces.')
    await ctx.close()
    return
  }

  // ── Enter Asheville through the SHELL's place strip (D-19, 17-05) ─────────
  const byAreaBefore = byAreaBodies.length
  const repsMeAfterEntry = []
  page.on('request', (r) => {
    if (/\/essentials\/representatives\/me/.test(r.url())) repsMeAfterEntry.push(r.url())
  })

  const walked = { entered: false, hero: null }
  try {
    await page.locator(`${STRIP} button[aria-expanded]`).first().click()
    await page.waitForTimeout(300)
    await typeInto(page, STRIP, PLACE_QUERY)
    await page.locator(`${STRIP} [role="option"]`).first().click()
    await page.waitForTimeout(3500)
    walked.entered = true
  } catch (err) {
    walked.error = String(err).split('\n')[0]
  }
  walked.hero = await page.evaluate(() => document.querySelector('h2')?.innerText?.trim() ?? null)

  if (!walked.entered || walked.hero !== PLACE_NAME) {
    check(
      tab, 2,
      `"${PLACE_QUERY}" did NOT resolve to a place on screen — the absence assertions cannot run`,
      false,
      `walk=${JSON.stringify(walked)}` +
        '\n            Look at walk.error, then at the two route stubs: a chosen row answers city' +
        '\n            and state, and resolveChosenPlace throws no-county without coordinate-lookup.',
    )
    console.log('  SKIP 3-15  NOT CHECKED — the member is still on their own spaces, which has every')
    console.log('            affordance, so neither the absences nor their inverse mean anything here.')
    await ctx.close()
    return
  }

  // 🔴 Choose an Imagine option FIRST, exactly as the control case does: the
  // Imagine textarea (#6) and "Share an idea" (#2) are inside `{option && …}`,
  // so without this click assertions 4 and 6 are true of a page that never had
  // them. The radios themselves are a view preference and are NOT gated.
  await page.locator(`${PANEL} [data-explore-module="imagine"] input[type="radio"]`)
    .first().click({ force: true }).catch(() => {})
  await page.waitForTimeout(500)

  const list = await read(page, PANEL)
  const listNotice = await page.evaluate(readNotice, { sel: PANEL })
  await openTopic(page, PANEL)
  const topic = await read(page, PANEL)
  const topicNotice = await page.evaluate(readNotice, { sel: PANEL })
  await closeTopic(page, PANEL)
  const both = (fn) => fn(list) && fn(topic)
  const where = (fn) => `list=${JSON.stringify(fn(list))} topicPage=${JSON.stringify(fn(topic))}`

  check(tab, 2, 'zero button[type="submit"] — list and topic page (#1)',
    both((v) => v.submits === 0), where((v) => v.submits))
  check(tab, 3, 'zero textarea — list and topic page (#5, #6)',
    both((v) => v.textareas === 0), where((v) => v.textareas))
  check(tab, 4, 'zero free-text input, radios and checkboxes excluded — list and topic page (#4)',
    both((v) => v.freeTextInputs === 0), where((v) => v.freeTextInputs))
  check(tab, 5, 'no write wording — list and topic page (#1, #2, #7, #8)',
    both((v) => v.writeWord === null), where((v) => v.writeWord))

  // ── 6  The notice names the OTHER-PLACE reason, not the sibling-shard one ─
  //
  // 🔴 `namesReason` rejects a notice that carries ANOTHER viewer's sentence, so
  // hard-coding the reason to 'sibling-shard' takes this down while viewers 1
  // and 2 stay green — the half-a-gate shape in its newest form.
  check(
    tab, 6,
    'the Explore notice names the other-place reason and offers a way back — list and topic page',
    namesReason(listNotice, 'other-place') && namesReason(topicNotice, 'other-place') && !!listNotice.button,
    `list=${JSON.stringify(listNotice)}\n            topicPage=${JSON.stringify(topicNotice)}`,
  )

  // ── 7  The seed invitation is ABSENT ──────────────────────────────────────
  check(
    tab, 7,
    'the seed invitation does NOT open for a member at a place that is not theirs',
    Array.isArray(list.modules) && !list.modules.includes('seed-invitation'),
    `modules=${JSON.stringify(list.modules)}` +
      '\n            Asheville is genuinely unseeded (zero meetings, no bespoke layer), so this' +
      '\n            module WOULD be second in the list. If it is there, registry.tsx lost the' +
      '\n            isAuthenticated / !isViewOnly terms. The invitation invites a VOTE.',
  )

  // ── 8  NOT over-gated, at a visited place ─────────────────────────────────
  if ((list.modules ?? []).includes('nearby')) {
    const gated = await readNotOverGated(page)
    check(
      tab, 8,
      'NOT over-gated at a visited place: "Save on this device" toggles both ways and the Imagine radios still select',
      gated.ok,
      JSON.stringify(gated) +
        '\n            A dead page fails D-18 from the other direction: observation is the expected' +
        '\n            default, for everyone, so another place\'s Explore has to still work.',
    )
  } else {
    console.log('  SKIP  8  NOT over-gated — the nearby module is not on this tab; City/County only')
  }

  // ── 9  D-10: the page does not address the visitor as a resident ──────────
  {
    const listText = await page.evaluate((sel) => document.querySelector(sel)?.innerText ?? '', PANEL)
    await openTopic(page, PANEL)
    const topicText = await page.evaluate((sel) => document.querySelector(sel)?.innerText ?? '', PANEL)
    await closeTopic(page, PANEL)
    const hits = [listText, topicText].map((t) => CLAIMS_THE_PLACE.exec(t)?.[0] ?? null)
    check(
      tab, 9,
      'D-10: no Explore chrome tells the member this place is theirs — list and topic page',
      hits.every((h) => h === null),
      `list=${JSON.stringify(hits[0])} topicPage=${JSON.stringify(hits[1])}` +
        '\n            🔴 The generic TOPIC QUESTIONS are deliberately not in CLAIMS_THE_PLACE —' +
        '\n            deferred item 3. See the regex\'s own comment before widening it.',
    )
  }

  // ── 10  The by-area POST carries the VISITED geoid ────────────────────────
  //
  // 🔴 Read from `request.postData()`, because by-area is a POST and the geoid
  // is in the BODY. A query-string reader cannot see this request at all.
  const bodiesAfterEntry = byAreaBodies.slice(byAreaBefore)
  check(
    tab, 10,
    `a by-area POST after entering the place carries the VISITED geoid ${VISITED_CITY_GEOID}`,
    bodiesAfterEntry.some((b) => (b ?? '').includes(VISITED_CITY_GEOID)),
    `bodies after entry: ${JSON.stringify(bodiesAfterEntry)} (before: ${byAreaBefore} request(s), own geoid ${OWN_CITY_GEOID})` +
      '\n            🔴 ON ITS OWN THIS IS WEAK, and the plan that asked for it overrated it:' +
      '\n            usePlaceRepresentatives fires for the visited place whether or not AppShell' +
      '\n            PASSES its result to the sidebar, so `repsData = ownReps` leaves this GREEN.' +
      '\n            Assertion 14 is the one that catches that revert. This one catches the hook' +
      '\n            not being wired, or being handed the wrong slices.',
  )

  // ── 11  Errors ───────────────────────────────────────────────── (below) ──

  // ── 12  /representatives/me is not the live source after entering ─────────
  check(
    tab, 12,
    'no request to /essentials/representatives/me after the place is entered',
    repsMeAfterEntry.length === 0,
    `seen: ${JSON.stringify(repsMeAfterEntry)}` +
      '\n            🔴 STRUCTURALLY VACUOUS FOR THIS HARNESS, and it is kept anyway — say so' +
      '\n            rather than reading it as the thing that caught a revert. The dev id is a' +
      '\n            SYNTHETIC id, so useRepresentatives short-circuits to fetchDevRepresentatives' +
      '\n            and never calls /representatives/me at all, before OR after the trip. This' +
      '\n            pins the production path, where it would be called, and costs one line.',
  )

  // ── 13  Exactly ONE by-area request per place change ──────────────────────
  check(
    tab, 13,
    'exactly ONE by-area request fired when the place changed',
    bodiesAfterEntry.length === 1,
    `${bodiesAfterEntry.length} request(s): ${JSON.stringify(bodiesAfterEntry)}` +
      '\n            🔴 THIS DOES NOT PIN THE SIX-PANEL RULE, and 17-06\'s plan claimed it did.' +
      '\n            TanStack Query dedupes by queryKey, so six components calling one hook with' +
      '\n            one key make ONE fetch — and since 17-04 no feed panel mounts at a visited' +
      '\n            place at all, so a hook moved into SliceFeedPanel fires ZERO times here, not' +
      '\n            six. What this DOES catch is an unstable query key and a refetch loop: 0 means' +
      '\n            the hook never ran, >1 means its key changes on every render.',
  )

  // ── 14  The rendered officials are the VISITED place's ────────────────────
  //
  // 🔴 The assertion the plan first conceded was impossible, on the grounds that
  // no script can tell one real person's name from another's. True, and
  // irrelevant: the revert is a WRONG SOURCE, and a source is observable. The
  // by-area stub tags every roster with the geo_id it was asked about, so this
  // is a string comparison with no network in it — deterministic, and no SKIP.
  const visitedTags = await page.evaluate(readRepsTags)
  check(
    tab, 14,
    `the sidebar renders the VISITED place's officials: ${visitedTags.tags.join(', ') || 'NONE'} (was ${ownTags.tags.join(', ')})`,
    visitedTags.widget &&
      visitedTags.tags.length > 0 &&
      visitedTags.tags.every((t) => t === `GEOID-${VISITED_CITY_GEOID}`) &&
      !visitedTags.tags.includes(`GEOID-${OWN_CITY_GEOID}`),
    `before=${JSON.stringify(ownTags)} after=${JSON.stringify(visitedTags)}` +
      '\n            🔴 THIS is the assertion that catches `repsData = ownReps`. Pitfall 9 is the' +
      '\n            member\'s own representatives rendering beside another city\'s conversations,' +
      '\n            and it is invisible to every other assertion here: the place query still' +
      '\n            fires, the counts are still right, and the names are real either way.' +
      '\n            Correctness — are these the right PEOPLE — is 17-07 Task 4\'s human read.',
  )

  // ── 15  cs_active_tab is NOT written while visiting ───────────────────────
  //
  // 🔴 A REAL BUG WITH NO COVERAGE. 17-05 fixed it — AppShell's handleTabChange
  // writes `cs_active_tab` only `if (!isVisitingPlace)` — and nothing watched
  // the fix: removing the guard left check:place-entry at 20 PASS, 0 FAIL.
  //
  // The consequence is quiet and permanent. `cs_active_tab` is the member's
  // choice for their OWN shell; another city's answer must not clobber it. With
  // the guard gone, a member who looks at Portland and presses State comes back
  // to their own State tab instead of the one they left, and `leavePlace` has
  // nothing true left to restore.
  //
  // Both halves are asserted, because the key alone is not the behaviour: the
  // key is unmoved WHILE visiting, and the member lands back on their own City
  // tab AFTER leaving. With the guard removed the second half fails too — the
  // shell comes back on State, and the banner reads Indiana rather than
  // Bloomington.
  {
    const probe = { planted: ownTab, duringVisit: null, afterLeaving: null, heroAfter: null, error: null }
    try {
      await page.locator(`${RAIL} [data-nav-tab="state"]`).first().click()
      await page.waitForTimeout(1200)
      probe.duringVisit = await page.evaluate(() => { try { return localStorage.getItem('cs_active_tab') } catch { return 'blocked' } })
      await page.locator(`${STRIP} [data-place-strip-leave]`).first().click()
      await page.waitForTimeout(2500)
      probe.afterLeaving = await page.evaluate(() => { try { return localStorage.getItem('cs_active_tab') } catch { return 'blocked' } })
      probe.heroAfter = await page.evaluate(() => document.querySelector('h2')?.innerText?.trim() ?? null)
    } catch (err) {
      probe.error = String(err).split('\n')[0]
    }
    check(
      tab, 15,
      "pressing a tab WHILE VISITING does not write cs_active_tab, and leaving comes back to the member's own tab",
      probe.planted === 'city' &&
        probe.duringVisit === 'city' &&
        probe.afterLeaving === 'city' &&
        probe.heroAfter === 'Bloomington',
      JSON.stringify(probe) +
        '\n            🔴 planted !== "city" is the VACUOUS case and is checked first: if the key was' +
        '\n            never "city" to begin with, "it is still city" says nothing.' +
        '\n            duringVisit === "state" means AppShell.handleTabChange lost its' +
        '\n            `if (!isVisitingPlace)` guard — the ONE line that keeps another city out of' +
        '\n            the member\'s remembered tab. heroAfter reading "Indiana" rather than' +
        '\n            "Bloomington" is the same bug seen from the member\'s side: they pressed' +
        '\n            State in Asheville and came home to their own State tab.',
    )
  }

  await ctx.close()

  if (errors.noise.length) {
    console.log(
      `  (noise) ${errors.noise.length} expected dev-id network errors suppressed: ` +
        [...new Set(errors.noise)].map((t) => t.slice(0, 64)).join(' | '),
    )
  }
  check(
    tab, 11,
    'zero uncaught page errors and zero unexpected console errors throughout',
    errors.page.length === 0 && errors.console.length === 0,
    [...errors.page, ...errors.console].slice(0, 3).join('\n            ') +
      '\n            A thrown render is not a gate: an exception while hiding a control can leave' +
      '\n            the control on screen.',
  )
}

const FIXTURES = await readFixtures()
await runSignedOut(FIXTURES)
await runMemberNoSlice()
await runMemberOtherPlace(FIXTURES)

await browser.close()

console.log(`\n${passed} PASS, ${failed} FAIL`)
if (failed) {
  console.log(`red: ${reds.join(', ')}`)
  console.log(
    'Read WHICH TAB and WHICH VIEWER failed. A City-only failure with Federal green is\n' +
      'the half-a-gate shape this script exists to expose — four of the ten affordances\n' +
      'exist only there. A signed-out-only failure with both member runs green is the\n' +
      'fail-open this gate was rewritten to close.',
  )
}
process.exit(failed === 0 ? 0 : 1)
