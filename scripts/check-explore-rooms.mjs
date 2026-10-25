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
 * ── Extending this for 16-09 ────────────────────────────────────────────────
 *
 * Assertions 3–8 are written against a ROOM LIST, not against the invitation.
 * Each entry declares a selector, how many controls the room is allowed, and
 * what clicking one must change. 16-09 adds its eleven reserved rooms by
 * appending to `ROOMS` and nothing else:
 *
 *   { id: 'symposiums', sel: '[data-explore-room="symposiums"]',
 *     controls: 0, consequence: null, requiredOn: [...] }
 *
 * `controls: 0` is the reserved rooms' case and makes assertions 6 and 7
 * vacuous for them BY DESIGN — a reserved room renders no control, and that is
 * the property. 16-09 will also want the three things this script does not do
 * yet, and they are listed under "What 16-09 still has to add" at the bottom.
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
 * 11 assertions. Exit non-zero on any failure. A SKIP is NOT a pass.
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
]

/** Prohibited shape 4, in the words it would actually be written in. */
const DEAD_END_WORDS = /coming soon|stay tuned|under construction|notify me|join the waitlist/i

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
 * ── What 16-09 still has to add ──────────────────────────────────────────────
 *
 * 1. Its eleven reserved rooms as `ROOMS` entries, `controls: 0`,
 *    `consequence: null`. Assertions 3–6 and 8 then cover them unchanged; 7
 *    skips them, correctly, since they have nothing to click.
 * 2. A PRESENCE assertion per reserved room, with the tabs each is expected on
 *    — 3–8 are all "zero of the bad thing", so a room that never rendered
 *    passes every one of them while proving nothing. That is the vacuous shape
 *    16-VALIDATION names, and assertion 1 above is the pattern to copy.
 * 3. The no-fact rule and the copy shapes (apology, "for your area" when the
 *    gap is universal) — 16-VALIDATION calls these assertions 12–16 — and the
 *    cap on rendered rooms per level, assertion 17.
 *
 * Numbering is deliberately left free from 12 up.
 */
process.exit(failed === 0 ? 0 : 1)
