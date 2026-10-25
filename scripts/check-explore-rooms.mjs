#!/usr/bin/env node
/**
 * check-explore-rooms.mjs — no room in Explore may offer a control that does nothing.
 *
 * Every non-interactive room in Explore — the seed invitation and the reserved
 * rooms — must contain no control that does nothing. A disabled button, or an
 * enabled one that stores nothing, is the "coming soon" dead end
 * `16-DESIGN.md` goal 6 forbids. Checked, not remembered.
 *
 * Run: npm run dev, then npm run check:explore-rooms [-- --port 5173]
 * No credential: it drives `?dev=1`, which opens on the reserved dev-guest id.
 *
 * 🔴 Why this script exists at all. 16-08 ships the seed invitation while the
 * seed VOTE is out of scope (Chris, 2026-10-24: "show it without the vote for
 * now"). The concern raised and overruled was that an invitation with nothing
 * behind it edges toward the dead end goal 6 forbids. It ships, so it has to
 * ship honestly, and the way it stops being honest is a control that looks live
 * and does nothing. Four shapes are prohibited:
 *
 *   1. a DISABLED button           → assertions 3 and 4
 *   2. an ENABLED button that
 *      stores or changes nothing   → assertion 7, and 7 is the one this
 *                                    script exists for. A check that only
 *                                    caught `disabled` would pass the worst
 *                                    case of the four.
 *   3. selections that evaporate   → assertion 5
 *   4. a bare "coming soon"        → assertion 8
 *
 * 🔴 Assertion 7 asserts the CONSEQUENCE, never the click. It dispatches the
 * click through the DOM rather than through Playwright's actionability checks,
 * then compares a fingerprint of the Explore panel before and after. A disabled
 * button fails it because the browser suppresses click on a disabled control;
 * an enabled button with a no-op handler fails it because nothing changed.
 * Reachability is assertion 6's job, and the two must stay separate.
 *
 * ── What 16-09 added ────────────────────────────────────────────────────────
 *
 * Assertions 3–8 were written against a ROOM LIST rather than against the
 * invitation, so 16-09 appended every room to `ROOMS` and they now run over
 * eight rooms on Asheville City instead of one. `controls: 0` is the reserved
 * rooms' case and makes assertions 6 and 7 vacuous for them BY DESIGN — a
 * reserved room renders no control, and that is the property.
 *
 * Then a LEVEL WALK — City (Asheville and Bloomington), County, State, Federal,
 * Unified — and assertions 12–19 over every room on every one of them.
 *
 * 🔴 **Assertion 18 is the one that makes 12–17 mean anything.** 3–8 and 12–17
 * are all "zero of the bad thing", so a room that never rendered passes every
 * single one of them while proving nothing — the vacuous shape 16-VALIDATION
 * names, and the reason assertion 1 exists for the invitation. 18 is that
 * guard for the other thirteen rooms: each one declares the levels it must
 * appear on, and its absence is a failure rather than a silent pass.
 *
 * Two notes on the numbering, so external references stay true:
 *
 * - 16-VALIDATION points at 14 (apology / "coming soon"), 15 ("for your area"
 *   when the gap is universal) and 17 (the cap). Those numbers are kept exactly
 *   where that document puts them, which is why presence lands at 18 rather
 *   than leading.
 * - 16-09's table numbered "zero page and console errors" 18. That check is
 *   **assertion 11**, which already accumulates page and console errors across
 *   every context this script opens — including the six the level walk adds —
 *   so it is not duplicated. 18 is the presence assertion 16-08's note demanded
 *   and the plan's table left unnumbered, and 19 is the mechanical half of the
 *   never-invent-civic-record rule that 16-VALIDATION assigns to this script.
 *
 * 🔴 Playwright is a GLOBAL install here, not a dependency — node_modules is
 * the wrong place to look (CLAUDE.md). The global package is CommonJS, so the
 * namespace exposes chromium under `default`: read both.
 *
 * 🔴 Playwright's `colorScheme` context option does nothing in this app. Dark is
 * class-based and set before first paint from the `ev_color_scheme` cookie,
 * never from `prefers-color-scheme` (src/lib/colorScheme.ts). The cookie is set
 * and `documentElement.classList` is ASSERTED to match.
 *
 * 19 assertions. Exit non-zero on any failure. A SKIP is NOT a pass.
 */

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = arg('--port', '5173')
const ORIGIN = `http://localhost:${PORT}`

/** The Explore tab panel (FORUM_VIEW_PANEL_ID.explore). CSS-hidden, not
 *  unmounted, while Conversations shows — so every query is scoped to it. */
const PANEL = '#forum-view-explore'

const INVITATION = '[data-explore-module="seed-invitation"]'

/**
 * The rooms assertions 3–8 run over. One entry today; 16-09 appends.
 *
 * `sel` is scoped to PANEL at query time. `controls` is how many `button`/`a`
 * elements the room is ALLOWED — exactly, not at most, because "one real
 * control" and "no control at all" are both properties worth pinning.
 * `consequence` says what clicking one must observably do; null means the room
 * has no control to click.
 */
const roomSel = (id) => `[data-explore-room="${id}"]`

/**
 * The six contexts the level walk opens. `?dev=1` is Asheville, which has zero
 * meetings and is therefore unseeded by construction; `&place=bloomington` is
 * the one city nationally with real agenda coverage.
 */
const LEVELS = [
  { key: 'city', tab: 'city', place: null, label: 'Asheville · City' },
  { key: 'city-bloomington', tab: 'city', place: 'bloomington', label: 'Bloomington · City' },
  { key: 'county', tab: 'county', place: null, label: 'Buncombe County · County' },
  { key: 'state', tab: 'state', place: null, label: 'North Carolina · State' },
  { key: 'federal', tab: 'federal', place: null, label: 'Federal' },
  { key: 'unified', tab: 'unified', place: null, label: 'Unified' },
]

const ROOMS = [
  {
    id: 'seed-invitation',
    label: 'the seed invitation',
    sel: INVITATION,
    controls: 1,
    // Its one control opens the first candidate topic, which replaces the whole
    // Explore view with that topic's page — so the module list empties.
    consequence: 'topic-detail',
  },

  /**
   * ── The nine reserved rooms ────────────────────────────────────────────────
   *
   * `requiredOn` is DETERMINISTIC for every one of these: each is listed in
   * DEFAULT_MODULES for those levels and its registry entry is `available: () =>
   * false`, so no API, no calendar and no election cycle can take it off the
   * page. Assertion 18 may therefore demand it outright rather than skip.
   */
  { id: 'ballot-measures', sel: roomSel('ballot-measures'), controls: 0, consequence: null,
    requiredOn: ['city', 'city-bloomington', 'county', 'state'] },
  { id: 'federal-votes', sel: roomSel('federal-votes'), controls: 0, consequence: null,
    requiredOn: ['federal'] },
  { id: 'debate-schedule', sel: roomSel('debate-schedule'), controls: 0, consequence: null,
    requiredOn: ['federal'] },
  { id: 'legislator-votes', sel: roomSel('legislator-votes'), controls: 0, consequence: null,
    requiredOn: ['state'] },
  { id: 'symposiums', sel: roomSel('symposiums'), controls: 0, consequence: null,
    requiredOn: ['city', 'city-bloomington', 'county', 'state', 'federal', 'unified'] },
  { id: 'civic-listening', sel: roomSel('civic-listening'), controls: 0, consequence: null,
    requiredOn: ['city', 'city-bloomington', 'county', 'state', 'federal', 'unified'] },
  { id: 'common-grounds', sel: roomSel('common-grounds'), controls: 0, consequence: null,
    requiredOn: ['city', 'city-bloomington', 'county', 'state', 'federal', 'unified'] },
  { id: 'focused-communities', sel: roomSel('focused-communities'), controls: 0, consequence: null,
    requiredOn: ['city', 'city-bloomington', 'county'] },
  { id: 'slice-action-votes', sel: roomSel('slice-action-votes'), controls: 0, consequence: null,
    requiredOn: ['city', 'city-bloomington', 'county', 'state', 'federal'] },

  /**
   * ── The four empty states of real modules ──────────────────────────────────
   *
   * 🔴 These are NOT reserved rooms and their presence is NOT deterministic:
   * each appears exactly when its module has nothing to show, which depends on
   * live public data and on the calendar. Requiring `races` would go red the
   * day after a general; requiring `coming-up` would go red whenever an
   * election is listed. So they carry `requiredOn` only where the fixture
   * itself guarantees the empty case, and are otherwise checked if present.
   *
   * `agenda` is the exception that can be demanded: Asheville has zero meetings
   * (`/api/meetings?city=Asheville` → 0 rows, research Finding 2), so its City
   * and County tabs show the agenda room no matter what the pipeline does
   * elsewhere. Bloomington is deliberately NOT in the list — there the module
   * renders for real, and between council sessions it correctly falls back.
   */
  { id: 'agenda', sel: roomSel('agenda'), controls: 0, consequence: null, requiredOn: ['city', 'county'] },
  { id: 'coming-up', sel: roomSel('coming-up'), controls: 0, consequence: null, requiredOn: [] },
  { id: 'races', sel: roomSel('races'), controls: 0, consequence: null, requiredOn: [] },
  { id: 'debates', sel: roomSel('debates'), controls: 0, consequence: null, requiredOn: [] },
]

/** Prohibited shape 4, in the words it would actually be written in. */
const DEAD_END_WORDS = /coming soon|stay tuned|under construction|notify me|join the waitlist/i

/**
 * Assertion 14's wider net: the dead end AND the apology.
 *
 * An apology is the other way a room stops being a welcome. "We're sorry" and
 * "unfortunately" both tell a member something has gone wrong for them, when
 * what has actually happened is that a feature has not arrived for anyone.
 */
const DEAD_END_OR_APOLOGY =
  /coming soon|stay tuned|under construction|notify me|waitlist|we['’]re sorry|we are sorry|unfortunately|sorry,/i

/**
 * Assertion 15. 🔴 `agenda` is the ONE room allowed to say this, because agenda
 * coverage genuinely is per-place — one city nationally. Ballot measures, bill
 * summaries and debate schedules are missing for everyone, and telling a member
 * their place is the poorly-served one is untrue as well as dispiriting.
 */
const LOCALISING_WORDS = /for your area|in your community/i
const MAY_LOCALISE = new Set(['agenda'])

/**
 * Assertion 19 — the mechanical half of "never invent civic record".
 *
 * A reserved room exists precisely because no source serves it, so ANY concrete
 * civic reference inside one is fabricated by construction. This catches the
 * shape a plausible-sounding placeholder takes: a bill or measure number, or a
 * year that would date a record. It cannot catch an invented sentence with no
 * number in it — nothing mechanical can — but it catches the form the
 * invention actually arrives in, which is "Proposition 12: Clean Water Act".
 *
 * 🔴 Reserved rooms ONLY. The four empty states of real modules may legitimately
 * carry a date or a reference once their module fills, and `coming-up` renders
 * an election year the moment one exists.
 */
const INVENTED_RECORD =
  /\b(?:ordinance|resolution|proposition|prop\.?|measure|amendment|h\.?\s?r\.?|s\.?\s?b\.?|a\.?\s?b\.?|senate bill|house bill|rc#)\s*#?\s*\d|\b(?:19|20)\d\d\b/i
const RESERVED_IDS = new Set([
  'ballot-measures', 'federal-votes', 'debate-schedule', 'legislator-votes',
  'symposiums', 'civic-listening', 'common-grounds', 'focused-communities', 'slice-action-votes',
])

/**
 * Assertion 17's cap — the overwhelm limit, as CARDS on screen rather than
 * rooms, because a card is what a member counts.
 *
 * Four is the arithmetic maximum the design can produce, not a round number:
 * at most three empty states of real modules on any one level (State can show
 * `races`, `debates` and `coming-up` at once; City/County can show `agenda` and
 * `coming-up`; Federal `races` and `debates`) plus the ONE grouped card that
 * holds every reserved room. Before 16-09 grouped them the real figure was 9.
 *
 * 🔴 If this goes red, the fix is the rendering, not the number. A fifth card
 * means either a new empty state or the group has come apart.
 */
const MAX_ROOM_CARDS = 4

/**
 * Console noise `?dev=1` produces BY DESIGN, and that is not a finding:
 * CLAUDE.md records that member-only APIs 401 for the dev id and the accounts
 * session endpoint sends no CORS header for localhost. The suppressed lines are
 * printed, so this allowlist cannot quietly become a place a real error hides.
 */
const EXPECTED_NOISE = [/Failed to load resource/, /blocked by CORS policy/, /net::ERR_/]

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
const skips = []

function check(n, label, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`  PASS ${String(n).padStart(2)}  ${label}`)
  } else {
    failed += 1
    reds.push(`#${n}`)
    console.log(`  FAIL ${String(n).padStart(2)}  ${label}${detail === undefined ? '' : `\n            ${detail}`}`)
  }
}

/** 🔴 A SKIP is not a pass. Printed so nobody can read it as one, and the exit
 *  code ignores it — but the run's last line names every one of them. */
function skip(n, label, why) {
  skips.push(`#${n} ${label}`)
  console.log(`  SKIP ${String(n).padStart(2)}  ${label}\n            ↳ ${why}`)
}

const DESKTOP = { width: 1440, height: 1000 }

// ── Page-side readers (one serialisable argument each) ───────────────────────

/**
 * Everything assertions 12–19 need about ONE level, in one round trip.
 *
 * 🔴 Reads the room's heading and body as SEPARATE elements rather than taking
 * the whole textContent. A room whose heading rendered and whose body did not
 * is a blank card with a title, which assertion 17 must catch — and a single
 * text blob cannot tell the two apart. The grouped rooms are `li` with an `h4`;
 * the standalone ones are `section` with an `h3`. Both are read.
 */
function readLevel({ panel }) {
  const p = document.querySelector(panel)
  if (!p) return { panelMissing: true }
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    panelMissing: false,
    modules: [...p.querySelectorAll('[data-explore-module]')].map((d) => d.dataset.exploreModule),
    // What a member counts: a bordered card, whether it holds one room or nine.
    cards: [...p.querySelectorAll('[data-explore-room-card]')].map((d) => ({
      kind: d.dataset.exploreRoomCard,
      rooms: d.querySelectorAll('[data-explore-room]').length,
    })),
    // Anywhere in the module list, not only inside a room — the dimmed dead
    // control is just as wrong three pixels outside one.
    panelDisabled: p.querySelectorAll('[disabled], [aria-disabled="true"]').length,
    rooms: [...p.querySelectorAll('[data-explore-room]')].map((d) => ({
      id: d.dataset.exploreRoom,
      heading: text(d.querySelector('h1, h2, h3, h4, h5, h6')),
      body: text(d.querySelector('p')),
      text: text(d),
      controls: d.querySelectorAll('button, a, input, textarea, select').length,
      controlLabels: [...d.querySelectorAll('button, a')].map((c) => text(c).slice(0, 40)),
      disabled: d.querySelectorAll('[disabled], [aria-disabled="true"]').length,
    })),
  }
}

/** Everything assertions 2–6 and 8 need about ONE room, in one round trip. */
function readRoom({ panel, sel }) {
  const p = document.querySelector(panel)
  if (!p) return { panelMissing: true }
  const room = p.querySelector(sel)
  if (!room) return { present: false }

  const all = [room, ...room.querySelectorAll('*')]
  const controls = [...room.querySelectorAll('button, a')]
  return {
    present: true,
    // textContent, not innerText: the module wrapper is `display: contents`
    // (ExploreView renders it that way so a hidden module leaves no gap), and
    // innerText is specified against a rendered box.
    text: (room.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: room.querySelectorAll('[disabled], [aria-disabled="true"]').length,
    // The room element itself can carry it too, which is why `all` includes it.
    notAllowed: all.filter((el) => getComputedStyle(el).cursor === 'not-allowed').length,
    inputs: room.querySelectorAll('input, textarea, select').length,
    controlCount: controls.length,
    controlLabels: controls.map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48)),
  }
}

/** elementFromPoint at each control's centre: does a click actually land on it? */
function hitTestControls({ panel, sel }) {
  const room = document.querySelector(panel)?.querySelector(sel)
  if (!room) return []
  return [...room.querySelectorAll('button, a')].map((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return { ok: false, why: 'zero-size box' }
    const cy = r.top + r.height / 2
    if (cy < 0 || cy > window.innerHeight) return { ok: false, why: `off-screen (top ${Math.round(r.top)})` }
    const at = document.elementFromPoint(r.left + r.width / 2, cy)
    return {
      ok: !!at && (at === el || el.contains(at)),
      w: Math.round(r.width),
      h: Math.round(r.height),
      blockedBy: at ? `${at.tagName.toLowerCase()}.${String(at.className || '').split(' ')[0]}` : 'nothing',
    }
  })
}

/**
 * What the Explore panel looks like right now, condensed.
 *
 * Assertion 7 compares this either side of a click. Both halves matter: the
 * module list empties when a topic page takes over the view, and the text
 * changes for any other kind of consequence a later room might have.
 */
function fingerprint({ panel }) {
  const p = document.querySelector(panel)
  if (!p) return { modules: [], text: '' }
  return {
    modules: [...p.querySelectorAll('[data-explore-module]')].map((d) => d.dataset.exploreModule),
    text: (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
  }
}

/**
 * 🔴 Clicks through the DOM, not through Playwright.
 *
 * Playwright's `.click()` performs actionability checks and would TIME OUT on a
 * disabled control — turning the assertion into a crash rather than a red line,
 * and telling us less. A DOM click reaches the handler on an enabled control
 * and is suppressed by the browser on a disabled one, which is exactly the
 * distinction assertion 7 is about. Reachability is assertion 6's job.
 */
function domClickFirstControl({ panel, sel }) {
  const el = document.querySelector(panel)?.querySelector(sel)?.querySelector('button, a')
  if (!el) return false
  el.click()
  return true
}

// ── The run ──────────────────────────────────────────────────────────────────

const chromium = await loadChromium()
if (!chromium) {
  console.error('Playwright not found locally or globally. It is a GLOBAL install here —')
  console.error('node_modules is the wrong place to look. See CLAUDE.md.')
  process.exit(1)
}

const browser = await chromium.launch()
const errors = { page: [], console: [], noise: [] }

/**
 * A context booted on one tab, at one dev place, with the theme already chosen.
 *
 * 🔴 `cs_active_tab` is written BEFORE first paint. Without it the run opens on
 * whichever tab the last run left behind, and every assertion below is about a
 * page nobody asked for.
 */
async function open({ tab, place }) {
  const ctx = await browser.newContext({ viewport: DESKTOP })
  await ctx.addCookies([{ name: 'ev_color_scheme', value: 'dark', domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.page.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    ;(EXPECTED_NOISE.some((re) => re.test(t)) ? errors.noise : errors.console).push(t)
  })
  await page.addInitScript((t) => {
    localStorage.setItem('cs_active_tab', t)
    // A clean profile: a leftover open topic would start the run on a topic
    // page rather than the module list, and every room would read as absent.
    for (const k of ['cs_explore_ui', 'cs_explore_drafts_v2', 'cs_explore_resume_v2']) localStorage.removeItem(k)
  }, tab)

  await page.goto(`${ORIGIN}/?dev=1${place ? `&place=${place}` : ''}`, { waitUntil: 'domcontentloaded' })
  // The rail is `hidden lg:flex`, so wait for it ATTACHED rather than visible.
  await page.waitForSelector('nav[aria-label="Civic space navigation"]', { timeout: 25000, state: 'attached' })
  await page.waitForTimeout(2500)
  // 🔴 Asserted, not assumed. Playwright's colorScheme would have changed nothing.
  const themeOk = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.getByRole('tab', { name: /Explore/i }).click()
  await page.waitForTimeout(1500)
  return { ctx, page, themeOk }
}

const readRoomOn = (page, sel) => page.evaluate(readRoom, { panel: PANEL, sel })
const modulesOn = (page) => page.evaluate(fingerprint, { panel: PANEL }).then((f) => f.modules)

// ── Asheville (unseeded), City ───────────────────────────────────────────────
//
// MOCK_SLICES.city.geoid is DEV_PLACES.asheville.city = '3702140', which
// public/geo/37.json resolves to "Asheville" with no network. Asheville has
// ZERO meetings, so it has no bespoke layer and is unseeded by construction —
// which is why it is the place this whole script runs on.

console.log(`\n── ASHEVILLE · CITY · unseeded ${'─'.repeat(28)}`)
{
  const { ctx, page, themeOk } = await open({ tab: 'city' })
  const EXPECTED_PLACE = 'Asheville'
  const TAB_LABEL = 'City'

  const room = await readRoomOn(page, INVITATION)

  check(
    1,
    'the seed invitation renders on an unseeded place',
    room.present === true,
    `modules on screen: ${(await modulesOn(page)).join(', ') || 'NONE'}` +
      '\n            If this is red every assertion below is vacuous. Check resolveComposition' +
      "\n            marks Asheville unseeded, and that the registry entry's available() is" +
      '\n            `isUnseeded && !!placeName` and not the inverted 16-06 guard.' +
      `\n            themeApplied=${themeOk}`,
  )

  if (!room.present) {
    console.log('  ↳ the invitation is absent; 2-8 cannot run on it.')
    await ctx.close()
  } else {
    // ── 2  It names the place ────────────────────────────────────────────────
    const holes = ['undefined', 'null', 'NaN'].filter((h) => room.text.includes(h))
    // A bare tab label is only wrong when it is NOT part of the real name:
    // "Buncombe County" legitimately contains "County".
    const bareLabel = !EXPECTED_PLACE.includes(TAB_LABEL) && new RegExp(`\\b${TAB_LABEL}\\b`).test(room.text)
    check(
      2,
      `it names the place — "${EXPECTED_PLACE}", with no hole and no bare tab label`,
      room.text.includes(EXPECTED_PLACE) && holes.length === 0 && !bareLabel,
      `holes=${holes.join(', ') || 'none'} bareLabel=${bareLabel}\n            text: ${room.text.slice(0, 220)}` +
        '\n            A sentence with a gap in it, or "Welcome to City", means placeName fell back' +
        '\n            to the tab label instead of resolving. AppShell passes null for that window' +
        '\n            and available() hides the module until it resolves.',
    )

    // ── 3–6, 8  Over every room in ROOMS ─────────────────────────────────────
    const rooms = []
    for (const spec of ROOMS) {
      const r = await readRoomOn(page, spec.sel)
      if (r.present) rooms.push({ spec, r, hits: await page.evaluate(hitTestControls, { panel: PANEL, sel: spec.sel }) })
    }

    const every = (fn) => rooms.every(({ spec, r, hits }) => fn(r, spec, hits))
    const report = (fn) => rooms.map(({ spec, r, hits }) => `${spec.id}=${JSON.stringify(fn(r, spec, hits))}`).join(' ')

    check(
      3,
      `zero [disabled] and zero [aria-disabled="true"] in ${rooms.length} room(s)`,
      every((r) => r.disabled === 0),
      report((r) => r.disabled) +
        '\n            Prohibited shape 1. Dimming a control is the advice for something' +
        '\n            temporarily unavailable to YOU; this one is unavailable to everyone until a' +
        '\n            later phase, and dimmed it reads as "broken" or "you are not allowed".',
    )
    check(
      4,
      'zero elements with a cursor-not-allowed computed cursor',
      every((r) => r.notAllowed === 0),
      report((r) => r.notAllowed) + '\n            Prohibited shape 1, the other half of it.',
    )
    check(
      5,
      'zero input, textarea and select — nothing to select, nothing to type',
      every((r) => r.inputs === 0),
      report((r) => r.inputs) +
        '\n            Prohibited shape 3: a selection that evaporates on reload is the same lie' +
        '\n            with extra steps, and worse, because it looks like it worked. Nothing in' +
        '\n            these rooms stores anything, so nothing in them may ask for anything.',
    )
    check(
      6,
      'each room has exactly the controls it declares, and every one hit-tests to itself',
      every((r, spec, hits) => r.controlCount === spec.controls && hits.every((h) => h.ok)),
      report((r, spec, hits) => ({ want: spec.controls, got: r.controlCount, labels: r.controlLabels, hits })) +
        '\n            A control that renders perfectly and cannot be clicked is a real shipped bug' +
        '\n            here: PR #92 put a credit link under a padded layer at the wrong z-index, at' +
        '\n            md and up only, so every screenshot and every phone looked fine.',
    )
    check(
      8,
      'no room says "coming soon", "stay tuned", "notify me" or "join the waitlist"',
      every((r) => !DEAD_END_WORDS.test(r.text)),
      report((r) => DEAD_END_WORDS.exec(r.text)?.[0] ?? null) +
        '\n            Prohibited shape 4 — the dead end goal 6 forbids, in its purest form.' +
        '\n            Saying what arrives next and then STOPPING is allowed and is the technique;' +
        '\n            a badge, a countdown or a notify-me is not.',
    )

    // ── 7  The consequence of a click, never the click ───────────────────────
    const clickable = rooms.filter(({ spec }) => spec.controls > 0 && spec.consequence)
    if (clickable.length === 0) {
      skip(7, 'a control changes the view observably', 'no room on screen declares a control')
    } else {
      const results = []
      for (const { spec } of clickable) {
        const before = await page.evaluate(fingerprint, { panel: PANEL })
        const dispatched = await page.evaluate(domClickFirstControl, { panel: PANEL, sel: spec.sel })
        await page.waitForTimeout(900)
        const after = await page.evaluate(fingerprint, { panel: PANEL })
        const changed = JSON.stringify(before) !== JSON.stringify(after)
        // 'topic-detail' is stricter than "something changed": the topic page
        // REPLACES the module list, so the list must be empty afterwards.
        const specific = spec.consequence === 'topic-detail' ? after.modules.length === 0 : true
        results.push({ id: spec.id, dispatched, changed, specific, modulesAfter: after.modules.length })
        // Back to the list for the next room.
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2500)
        await page.getByRole('tab', { name: /Explore/i }).click()
        await page.waitForTimeout(1200)
      }
      check(
        7,
        'clicking a room’s control changes the view observably — the consequence, not the click',
        results.every((r) => r.dispatched && r.changed && r.specific),
        JSON.stringify(results) +
          '\n            🔴 THIS IS THE ASSERTION THIS SCRIPT EXISTS FOR. Prohibited shape 2: an' +
          '\n            ENABLED control with a handler that does nothing is the version that looks' +
          '\n            alive, and a member told their voice counted when nothing was stored has' +
          '\n            been lied to. `dispatched:false` means no control was found; `changed:false`' +
          '\n            with dispatched:true is either a no-op handler or a disabled control, whose' +
          '\n            click the browser suppresses. Fix the handler, not the assertion.',
      )
    }
    await ctx.close()
  }
}

// ── Bloomington (seeded, usually), City ──────────────────────────────────────

console.log(`\n── BLOOMINGTON · CITY · seeded while the agenda is fresh ${'─'.repeat(5)}`)
{
  const { ctx, page } = await open({ tab: 'city', place: 'bloomington' })
  const modules = await modulesOn(page)
  const room = await readRoomOn(page, INVITATION)
  const agendaRendered = modules.includes('agenda')

  /**
   * 🔴 This assertion ROTS, and it must rot into a SKIP rather than a failure.
   *
   * Bloomington is "seeded" only while its most recent agenda is inside 16-06's
   * 45-day freshness window. The Common Council meets every few weeks so most
   * of the time it is — but between sessions, or if the pipeline pauses, the
   * agenda module falls back to its reserved room, `isUnseeded` flips to true,
   * and the invitation CORRECTLY appears. A flat "the invitation is absent on
   * Bloomington" would then fail while the app behaves exactly as designed, and
   * a check that cries wolf on a calendar gets switched off.
   */
  if (agendaRendered) {
    check(
      9,
      'on seeded Bloomington the invitation is ABSENT while the agenda section renders',
      room.present === false,
      `modules: ${modules.join(', ')}\n            text: ${(room.text ?? '').slice(0, 160)}` +
        '\n            The invitation leaked onto a place that has content. isUnseeded is computed' +
        '\n            from the bespoke topics that SURVIVED resolveComposition\'s geoid check, so a' +
        '\n            red line here means the agenda rendered from somewhere the composition did' +
        '\n            not keep.',
    )
  } else {
    skip(
      9,
      'on seeded Bloomington the invitation is absent',
      'Bloomington has no agenda inside the freshness window today; the invitation is\n' +
        '              expected and this assertion cannot run. Not a pass — and not a bug either:\n' +
        `              modules on screen were [${modules.join(', ')}], and the invitation was ` +
        `${room.present ? 'present, which is correct' : 'absent, which is odd — look at it'}.`,
    )
  }
  await ctx.close()
}

// ── Federal and Unified ──────────────────────────────────────────────────────
//
// Neither has a place to seed. compositionKey() normalises both to the slice
// type alone — one nation-wide key — so resolveComposition's geoid is null and
// isUnseeded is false whatever the fixture's geoid happens to be. Neither
// composition even lists the module.

console.log(`\n── FEDERAL and UNIFIED · nothing to seed ${'─'.repeat(21)}`)
{
  const seen = []
  for (const tab of ['federal', 'unified']) {
    const { ctx, page } = await open({ tab })
    const room = await readRoomOn(page, INVITATION)
    seen.push({ tab, present: room.present, modules: (await modulesOn(page)).join(', ') })
    await ctx.close()
  }
  check(
    10,
    'the invitation is absent on Federal and on Unified',
    seen.every((s) => s.present === false),
    seen.map((s) => `${s.tab}: present=${s.present} [${s.modules}]`).join('\n            ') +
      '\n            Nobody can seed a place the app cannot name, and a nation-wide key is not a' +
      '\n            place. check:composition 60 and 61 are the pure half of this.',
  )
}

// ── 12–19  Every room, on every level ────────────────────────────────────────
//
// 🔴 Assertions 3–8 above run on ONE tab at ONE dev place, which is right for
// the invitation — it only exists on an unseeded place. The other thirteen
// rooms are spread across five levels and two places, and the sibling trap this
// repo already fell into once is a check that is green about a tab it never
// opened. So this walks all six contexts and asserts over the union.

console.log(`\n── EVERY LEVEL · every room ${'─'.repeat(33)}`)

/** `{ levelKey: readLevel() }`, every context, gathered before anything is asserted. */
const byLevel = {}
for (const level of LEVELS) {
  const { ctx, page } = await open({ tab: level.tab, place: level.place })
  const seen = await page.evaluate(readLevel, { panel: PANEL })
  byLevel[level.key] = seen
  console.log(
    `  · ${level.label.padEnd(26)} ${String(seen.cards?.length ?? 0).padStart(2)} card(s), ` +
      `${String(seen.rooms?.length ?? 0).padStart(2)} room(s): ${(seen.rooms ?? []).map((r) => r.id).join(', ') || 'NONE'}`,
  )
  await ctx.close()
}

/** Every (level, room) pair on screen, flattened, so one pass answers 12–17 and 19. */
const allRooms = []
for (const level of LEVELS) {
  for (const r of byLevel[level.key]?.rooms ?? []) allRooms.push({ level: level.key, ...r })
}
const where = (fn) =>
  allRooms.filter(fn).map((r) => `${r.level}/${r.id}`).join(', ') || 'none'

check(
  12,
  `zero button, a, input, textarea and select inside ${allRooms.length} rendered room(s)`,
  allRooms.every((r) => r.controls === 0),
  `offenders: ${where((r) => r.controls > 0)}\n            ` +
    JSON.stringify(allRooms.filter((r) => r.controls > 0).map((r) => ({ at: `${r.level}/${r.id}`, labels: r.controlLabels }))) +
    '\n            A room with nothing to do has nothing to press. The reserved rooms have no' +
    '\n            handler to wire, so a control in one could ONLY be a control that does' +
    '\n            nothing — prohibited shape 2, and the thing this whole script is about.',
)

check(
  13,
  'zero [disabled] and zero [aria-disabled="true"] anywhere in the Explore module list, on any level',
  LEVELS.every((l) => (byLevel[l.key]?.panelDisabled ?? 0) === 0),
  LEVELS.map((l) => `${l.key}=${byLevel[l.key]?.panelDisabled}`).join(' ') +
    '\n            Wider than assertion 3, which only looks inside a room. A dimmed control three' +
    '\n            pixels outside one reads exactly the same to a member: "broken", or "you are' +
    '\n            not allowed". Nothing in Explore is temporarily unavailable to YOU.',
)

check(
  14,
  'no room says "coming soon", "stay tuned", "notify me", "waitlist", "we’re sorry" or "unfortunately"',
  allRooms.every((r) => !DEAD_END_OR_APOLOGY.test(r.text)),
  `offenders: ${where((r) => DEAD_END_OR_APOLOGY.test(r.text))}\n            ` +
    JSON.stringify(allRooms.filter((r) => DEAD_END_OR_APOLOGY.test(r.text)).map((r) => ({ at: `${r.level}/${r.id}`, hit: DEAD_END_OR_APOLOGY.exec(r.text)?.[0] }))) +
    '\n            The dead end goal 6 forbids, and the apology beside it. Saying what arrives and' +
    '\n            then STOPPING is allowed and is the technique; a badge, a countdown, a notify-me' +
    '\n            or an "unfortunately" is not.',
)

check(
  15,
  `no room says "for your area" or "in your community" — except ${[...MAY_LOCALISE].join(', ')}`,
  allRooms.every((r) => MAY_LOCALISE.has(r.id) || !LOCALISING_WORDS.test(r.text)),
  `offenders: ${where((r) => !MAY_LOCALISE.has(r.id) && LOCALISING_WORDS.test(r.text))}` +
    '\n            Ballot measures, bill summaries and debate schedules are missing for EVERYONE.' +
    '\n            Localising a universal gap tells a member their place is the poorly-served one,' +
    '\n            which is untrue and dispiriting at the same time. Agenda coverage genuinely is' +
    '\n            per-place — one city nationally — so that room, and only that room, may say so.',
)

check(
  16,
  'every rendered room has a non-empty heading AND a non-empty body',
  allRooms.every((r) => r.heading.length > 0 && r.body.length > 0),
  `offenders: ${where((r) => !r.heading || !r.body)}\n            ` +
    JSON.stringify(allRooms.filter((r) => !r.heading || !r.body).map((r) => ({ at: `${r.level}/${r.id}`, heading: r.heading, body: r.body }))) +
    '\n            A blank card is worse than no card: it reads as something that failed to load.' +
    '\n            Heading and body are read as SEPARATE elements on purpose — a title with no' +
    '\n            sentence under it is exactly this failure, and one text blob cannot see it.',
)

{
  const counts = LEVELS.map((l) => ({ key: l.key, n: byLevel[l.key]?.cards?.length ?? 0 }))
  check(
    17,
    `at most ${MAX_ROOM_CARDS} room cards on any single level`,
    counts.every((c) => c.n <= MAX_ROOM_CARDS),
    counts.map((c) => `${c.key}=${c.n}`).join(' ') +
      '\n            The overwhelm anti-goal, counted. Before 16-09 grouped the reserved rooms this' +
      '\n            read 7/6/7/8/7/3 and State closed on nine dashed cards, 33% of the panel —' +
      '\n            every sentence fine, the page a wall of promises. Fix the rendering, not the' +
      '\n            number: a fifth card means a new empty state, or the group has come apart.',
  )
}

{
  // 🔴 18 is the anti-vacuity guard. 3–8 and 12–17 are all "zero of the bad
  // thing"; a room that never rendered passes every one of them.
  const missing = []
  for (const spec of ROOMS) {
    for (const want of spec.requiredOn ?? []) {
      const present = (byLevel[want]?.rooms ?? []).some((r) => r.id === spec.id)
      if (!present) missing.push(`${want}/${spec.id}`)
    }
  }
  const required = ROOMS.reduce((a, s) => a + (s.requiredOn?.length ?? 0), 0)
  check(
    18,
    `every room declared for a level is actually ON it — ${required} (level, room) pairs`,
    missing.length === 0,
    `missing: ${missing.join(', ') || 'none'}` +
      '\n            🔴 THIS IS WHAT MAKES 12–17 MEAN ANYTHING. Every one of them is "zero of the bad' +
      '\n            thing", so a room that never reached the page passes all six while proving' +
      '\n            nothing — the vacuous shape 16-VALIDATION names. Every pair listed here is' +
      '\n            deterministic: a reserved room is in DEFAULT_MODULES and is never available, and' +
      '\n            Asheville has zero meetings. If one is missing, the registry or the composition' +
      '\n            dropped it, and the rest of this run was a green light over nothing.',
  )
}

{
  const reserved = allRooms.filter((r) => RESERVED_IDS.has(r.id))
  check(
    19,
    `no reserved room carries a bill, measure or ordinance number or a year — ${reserved.length} checked`,
    reserved.every((r) => !INVENTED_RECORD.test(r.text)),
    `offenders: ${reserved.filter((r) => INVENTED_RECORD.test(r.text)).map((r) => `${r.level}/${r.id}=${INVENTED_RECORD.exec(r.text)?.[0]}`).join(', ') || 'none'}` +
      '\n            Invented civic record, in the form it actually arrives in: "Proposition 12 —' +
      '\n            Clean Water Act (Sample)". A reserved room exists BECAUSE no source serves it,' +
      '\n            so every concrete reference inside one is fabricated by construction. Scoped to' +
      '\n            the nine reserved rooms: the four empty states of real modules may legitimately' +
      '\n            carry a date once their module fills, and coming-up renders an election year.',
  )
}

// ── 11  Errors ───────────────────────────────────────────────────────────────

await browser.close()

console.log('')
if (errors.noise.length) {
  console.log(
    `  (noise) ${errors.noise.length} expected dev-id network errors suppressed: ` +
      [...new Set(errors.noise)].map((t) => t.slice(0, 64)).join(' | '),
  )
}
check(
  11,
  'zero uncaught page errors and zero unexpected console errors throughout',
  errors.page.length === 0 && errors.console.length === 0,
  [...errors.page, ...errors.console].slice(0, 3).join('\n            ') +
    '\n            A thrown render is not a gate: an exception while hiding a control can leave' +
    '\n            the control on screen.',
)

console.log(`\n${passed} PASS, ${failed} FAIL${skips.length ? `, ${skips.length} SKIP` : ''}`)
if (skips.length) {
  console.log('🔴 A SKIP IS NOT A PASS. Not checked this run:')
  for (const s of skips) console.log(`   ${s}`)
}
if (failed) {
  console.log(`red: ${reds.join(', ')}`)
  console.log(
    'Assertion 7 red means a control that renders and does nothing. Fix the handler,\n' +
      'not the assertion — it is the single failure mode this script was written for.',
  )
}

/**
 * ── What 16-08 left for 16-09, and where each of the three landed ────────────
 *
 * 1. The rooms as `ROOMS` entries with `controls: 0` → done; 3–8 now run over
 *    eight rooms on Asheville City instead of one.
 * 2. A PRESENCE assertion per room → **assertion 18**, over 30 (level, room)
 *    pairs, every one of them deterministic.
 * 3. The no-fact rule and the copy shapes → 14, 15 and 19; the cap → 17.
 *
 * ── What is still NOT checked here, stated rather than hidden ────────────────
 *
 * - **Whether the copy is any good.** Prose quality is not mechanisable.
 *   16-VALIDATION says so, and the mitigation is a human reading all thirteen
 *   consecutively and out loud (16-09 Task 1 Step 2). 14, 15 and 19 catch only
 *   the specific wrong shapes.
 * - **The four-way look.** This script runs one theme at one viewport, dark
 *   desktop. `shoot:explore` and 16-10 own light, and mobile, and the human who
 *   opens the PNGs.
 * - **`races`, `debates` and `coming-up` presence.** Data- and calendar-
 *   dependent, so they carry an empty `requiredOn` and are checked only when
 *   they happen to render. Requiring them would go red the day after a general.
 */
process.exit(failed === 0 ? 0 : 1)
