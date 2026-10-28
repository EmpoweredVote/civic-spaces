#!/usr/bin/env node
/**
 * shoot-explore.mjs — the four-way visual pass over Explore. No credential needed.
 *
 *   npm run dev
 *   npm run shoot:explore [-- --port 5173] [-- --out explore-shots]
 *
 * 🔴 A CLEAN RUN ONLY PROVES THE PIXELS DECODED. scripts/shoot-banners.mjs's own
 * lesson, recorded in CLAUDE.md: a script that exits 0 having written 28 PNGs has
 * verified that 28 PNGs are writable. LOOK AT THE IMAGES. This script's job is to
 * put every one of the four presentations in front of a human and to print, beside
 * each, what was actually on screen — because a screenshot cannot tell "absent"
 * from "scrolled out of view".
 *
 * ── Why most of this needs no token, and which part does ────────────────────
 *
 * `?dev=1` opens on the reserved `dev-guest` id with fixture slices and real
 * public data through the /api proxy, 16-06 added `&place=bloomington`, and
 * 16-05 added a City sibling so the view-only state is reachable too. So groups
 * A1–A3 run on a fresh clone.
 *
 * 🔴 The genuinely SIGNED-OUT shots are not reachable on a fresh clone. With no
 * VITE_SUPABASE_URL, useAuth enters dev-guest mode unconditionally
 * (`import.meta.env.DEV && (?dev=1 || !VITE_SUPABASE_URL)`, useAuth.ts:219-225),
 * so dropping `?dev=1` does not sign you out — it keeps you signed in. Reaching
 * the signed-out branch (AppShell.tsx:866-886) needs VITE_SUPABASE_URL set in
 * .env.local AND no cs_token. That is a configuration, not a credential, but it
 * is a setup step, and shooting the dev-guest page and labelling it "signed out"
 * would be a lie this script must not tell. So group B is opt-in, and when it is
 * skipped the four missing presentations are NAMED in the summary.
 *
 * 🔴 A SKIP IS NOT A PASS. Nobody may read "28 images" as "the four-way pass is
 * complete" when group B was skipped.
 *
 * ── The traps this repo has already paid for ────────────────────────────────
 *
 * 🔴 Playwright is a GLOBAL install here, not a dependency — node_modules is the
 * wrong place to look (CLAUDE.md). The global package is CommonJS, so the
 * namespace exposes chromium under `default`: read both, or this silently yields
 * undefined.
 *
 * 🔴 Playwright's `colorScheme` context option does NOTHING in this app. The
 * bootstrap in index.html ignores prefers-color-scheme on purpose and reads the
 * `ev_theme` cookie (src/lib/colorScheme.ts). A context asking for light
 * still renders dark, and a "four-way" run silently becomes two. So the theme is
 * set by cookie-and-class and `documentElement.classList` is ASSERTED to match
 * before every single shot. A mismatch aborts rather than shooting.
 *
 * 🔴 `cs_active_tab` persists in localStorage and the app lands on `federal` by
 * default. It is written before first paint, and after every tab click the click
 * is VERIFIED against both `aria-current` and the value AppShell persisted — so
 * a renamed nav row fails loudly instead of shooting the wrong tab five times.
 *
 * ── What comes out ──────────────────────────────────────────────────────────
 *
 * Per cell, two kinds of image, because they answer different questions:
 *
 *   {cell}-full.png   the whole document in one strip, at scale 1. Answers
 *                     "does this page read as mostly empty rooms?" and catches
 *                     a composition that collapsed. Too tall to read small print.
 *   {cell}-f1..fN.png viewport frames walking down the page at scale 2. Readable
 *                     at the size Chris will read them, which is what the
 *                     contrast and clipping questions need.
 */
import { mkdirSync, existsSync, readdirSync, unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = arg('--port', '5173')
const OUT = arg('--out', 'explore-shots')
const ORIGIN = `http://localhost:${PORT}`

/** The Explore tab panel (FORUM_VIEW_PANEL_ID.explore). CSS-hidden, not
 *  unmounted, while Conversations shows — so every read is scoped to it. */
const PANEL = '#forum-view-explore'

const DESKTOP = { name: 'desktop', width: 1440, height: 1000 }
const MOBILE = { name: 'mobile', width: 390, height: 844 }
const VIEWPORTS = [DESKTOP, MOBILE]
const THEMES = ['light', 'dark']

/**
 * The nav rail's civic-space rows, in the order AppShell renders them, with the
 * `cs_active_tab` value each one persists. The label is a regex because City and
 * County show the RESOLVED PLACE NAME ("Bloomington", "Monroe County"), not the
 * level — which is also why the click is verified rather than assumed.
 */
const TAB_ROWS = {
  city: /^🏠/u,
  county: /^🏢/u,
  state: /^🚩/u,
  federal: /^🏛/u,
  unified: /^🌐/u,
}

/**
 * The four groups. Group A is 28 images and runs on a fresh clone; group B adds
 * 4 and is skipped, loudly, when .env.local has no VITE_SUPABASE_URL.
 */
const GROUP_A = [
  {
    key: 'bloomington',
    label: 'Bloomington, IN — the seeded proof city',
    url: '/?dev=1&place=bloomington',
    tabs: ['city', 'county', 'state', 'federal', 'unified'],
    viewOnly: false,
  },
  {
    key: 'asheville',
    label: 'Asheville, NC — unseeded, where the seed invitation leads',
    url: '/?dev=1',
    /**
     * 🔴 All five tabs, not just City — the plan asked for City alone and that
     * was a blind spot.
     *
     * The featured card borrows a credited place photo from another of the
     * member's slices, and `featuredPhoto` requires `hero.credit`. Bloomington's
     * shared-library banner carries NO credit, so on `&place=bloomington` the
     * borrow silently resolves to null on every tab and the card falls back to
     * its illustration. Asheville's banner IS credited. So Asheville is the only
     * fixture on which the borrowed-photo path renders at all, and shooting only
     * its City tab left the one place that path is visible uncovered — which is
     * how `deferred-items.md` item 2 (an Asheville skyline beside "Where should
     * the United States be involved abroad?") survived 16-04 and very nearly
     * survived this plan.
     */
    tabs: ['city', 'county', 'state', 'federal', 'unified'],
    viewOnly: false,
  },
  {
    key: 'viewonly',
    label: 'City Slice 2 — a sibling shard, read-only',
    url: '/?dev=1',
    tabs: ['city'],
    viewOnly: true,
  },
]

/** The four presentations group B covers, named here so a skip can name them. */
const GROUP_B_CELLS = [
  'signedout-place-light-desktop',
  'signedout-place-dark-desktop',
  'signedout-place-light-mobile',
  'signedout-place-dark-mobile',
]

const SKIP_LINE =
  'signed-out shots skipped: set VITE_SUPABASE_URL in .env.local to reach the signed-out\n' +
  '  branch; with no backend configured the app always enters dev-guest mode'

/**
 * Console noise `?dev=1` produces by design, and that is not a finding:
 * CLAUDE.md records that member-only APIs 401 for the dev id, and the accounts
 * session endpoint sends no CORS header for localhost. The suppressed lines are
 * counted and printed, so this allowlist cannot quietly become a hiding place.
 */
const EXPECTED_NOISE = [/Failed to load resource/, /blocked by CORS policy/, /net::ERR_/]

/**
 * Playwright is not a dependency of this repo — it is a GLOBAL install, so
 * node_modules is the wrong place to look. Resolve a local devDependency first,
 * then the global root. The global package is CommonJS, so the namespace exposes
 * chromium under `default`: read both.
 */
async function loadChromium() {
  const specs = ['playwright']
  try {
    const { execFileSync } = await import('node:child_process')
    const { pathToFileURL } = await import('node:url')
    const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).trim()
    if (root) specs.push(pathToFileURL(join(root, 'playwright', 'index.js')).href)
  } catch {
    /* no global npm root; local-only is fine */
  }
  for (const spec of specs) {
    try {
      const mod = await import(spec)
      const c = mod.chromium ?? mod.default?.chromium
      if (c) return c
    } catch {
      /* try the next location */
    }
  }
  return null
}

// ── Page-side readers (one serialisable argument each) ───────────────────────

/**
 * What was actually on screen. The point of shoot-app.mjs's `seen` block is that
 * a screenshot cannot tell "absent" from "scrolled out of view", so the things a
 * reader would otherwise have to infer from pixels are measured instead.
 */
function readSeen(sel) {
  const bodyText = (document.body.innerText || '').trim().replace(/\s+/g, ' ')
  const docHeight = Math.round(document.documentElement.scrollHeight)

  /**
   * 🔴 The SIGNED-OUT branch has no panel. AppShell renders ExploreView directly
   * into a bare `max-w-3xl` wrapper (AppShell.tsx:1054-1074) — there are no
   * Explore/Conversations tabs to belong to. Scoping to `#forum-view-explore`
   * there would report "no Explore" about a page that is almost entirely
   * Explore. Body scope is safe precisely because Explore renders ONCE in this
   * app (16-SHARED's "Explore renders once" constraint), so nothing else in the
   * document carries these attributes.
   */
  let p = document.querySelector(sel)
  let scope = 'panel'
  if (!p || p.offsetParent === null) {
    if (document.querySelector('[data-explore-module]')) {
      p = document.body
      scope = 'signed-out (no panel wrapper)'
    }
  }
  if (!p) return { missing: true, bodyText, docHeight }
  if (p !== document.body && p.offsetParent === null) return { hidden: true, bodyText, docHeight }
  const text = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ')

  // The agenda section is a module, so its presence is a composition fact; its
  // item count is a data fact, and 16-06's 45-day window can legitimately make it
  // zero between council sessions.
  const agenda = p.querySelector('[data-explore-module="agenda"]')
  const agendaItems = agenda ? agenda.querySelectorAll('article').length : 0
  const agendaLead = agenda ? text(agenda.querySelector('p')) : null

  const headings = [...p.querySelectorAll('h1, h2, h3')]
    .filter((h) => h.offsetParent !== null)
    .map((h) => text(h))
    .filter(Boolean)

  return {
    scope,
    modules: [...p.querySelectorAll('[data-explore-module]')].map((d) => d.dataset.exploreModule),
    rooms: [...p.querySelectorAll('[data-explore-room]')].map((d) => d.dataset.exploreRoom),
    // The wrapper on a module carries `className="contents"` and generates NO
    // box, so getBoundingClientRect() on it returns zero height. The room CARDS
    // are the measurable things.
    roomCards: [...p.querySelectorAll('[data-explore-room-card]')].map((d) => d.dataset.exploreRoomCard),
    agendaRendered: !!agenda,
    agendaItems,
    agendaLead,
    firstHeading: headings[0] ?? null,
    viewOnlyNotice: !!p.querySelector('[data-explore-view-only-notice]'),
    panelHeight: Math.round(p.getBoundingClientRect().height),
    scrollY: Math.round(window.scrollY),
    docHeight: Math.round(document.documentElement.scrollHeight),
  }
}

// ── The run ──────────────────────────────────────────────────────────────────

const chromium = await loadChromium()
if (!chromium) {
  console.error('Playwright not found locally or globally. It is a GLOBAL install here —')
  console.error('node_modules is the wrong place to look. See CLAUDE.md.')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
// A stale PNG from a previous run that no longer has a cell is worse than no
// PNG: it is a picture of code that is gone, and it looks exactly like evidence.
for (const f of readdirSync(OUT)) if (f.endsWith('.png')) unlinkSync(join(OUT, f))

const browser = await chromium.launch()
const errors = { page: [], console: [], noise: [] }
const written = []
const notes = []

function attachErrorSinks(page) {
  page.on('pageerror', (e) => errors.page.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    ;(EXPECTED_NOISE.some((re) => re.test(t)) ? errors.noise : errors.console).push(t)
  })
}

/** One context, one page load, booted on `tab` with `theme` already chosen. */
async function openGroup(group, firstTab, theme) {
  const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 })
  await ctx.addCookies([{ name: 'ev_theme', value: theme, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()
  attachErrorSinks(page)
  await page.addInitScript((t) => {
    // 🔴 Before first paint. The app lands on `federal` otherwise, and five
    // shots of the wrong tab look exactly like five shots of the right one.
    localStorage.setItem('cs_active_tab', t)
    // A clean profile: a leftover open topic would start the run on a topic page
    // instead of the module list, and the composition would read as empty.
    for (const k of ['cs_explore_ui', 'cs_explore_drafts_v2', 'cs_explore_resume_v2', 'cs_saved_adventures']) {
      localStorage.removeItem(k)
    }
  }, firstTab)
  await page.goto(`${ORIGIN}${group.url}`, { waitUntil: 'domcontentloaded' })
  // The rail is `hidden lg:flex`, so wait for it ATTACHED rather than visible.
  await page.waitForSelector('nav[aria-label="Civic space navigation"]', { timeout: 25000, state: 'attached' })
  await page.waitForTimeout(3500)
  return { ctx, page }
}

/**
 * 🔴 Asserted, never assumed. Playwright's colorScheme would have changed
 * nothing, so the only evidence that this is the theme we asked for is the class
 * on <html>. A mismatch is a hard stop: a "four-way" run that is silently two is
 * worse than no run, because it looks like coverage.
 */
async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.cookie = `ev_theme=${t}; path=/; max-age=31536000; SameSite=Lax`
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, theme)
  await page.waitForTimeout(350)
  const ok = await page.evaluate(
    (t) => document.documentElement.classList.contains('dark') === (t === 'dark'),
    theme,
  )
  if (!ok) throw new Error(`theme ${theme} did not apply — documentElement.dark does not match`)
}

/**
 * Click a civic-space row in the nav rail, then PROVE the click landed: the row
 * must carry aria-current, and AppShell must have persisted the tab key. Without
 * both, a renamed row or a reordered rail shoots the wrong tab in silence.
 *
 * Always driven at DESKTOP width — the rail is `hidden lg:flex`, and below lg
 * navigation moves to SliceTabBar. Switching at one width and shooting at two is
 * deliberate.
 */
async function clickTab(page, tab) {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height })
  await page.waitForTimeout(250)
  const pattern = TAB_ROWS[tab]
  const clicked = await page.evaluate((src) => {
    const re = new RegExp(src.source, src.flags)
    const nav = document.querySelector('nav[aria-label="Civic space navigation"]')
    const row = [...(nav?.querySelectorAll('button') ?? [])].find((b) => re.test((b.textContent || '').trim()))
    if (!row) return false
    row.click()
    return true
  }, { source: pattern.source, flags: pattern.flags })
  if (!clicked) throw new Error(`no nav rail row matched ${pattern} for tab "${tab}"`)
  await page.waitForTimeout(1400)

  const landed = await page.evaluate((src) => {
    const re = new RegExp(src.source, src.flags)
    const nav = document.querySelector('nav[aria-label="Civic space navigation"]')
    const row = [...(nav?.querySelectorAll('button') ?? [])].find((b) => re.test((b.textContent || '').trim()))
    return {
      current: row?.getAttribute('aria-current') === 'true',
      persisted: localStorage.getItem('cs_active_tab'),
      label: (row?.textContent || '').trim(),
    }
  }, { source: pattern.source, flags: pattern.flags })

  if (!landed.current || landed.persisted !== tab) {
    throw new Error(
      `tab click did not land: asked "${tab}", aria-current=${landed.current}, ` +
        `cs_active_tab=${landed.persisted}, row="${landed.label}"`,
    )
  }
  return landed.label
}

/** Conversations → the slice pill → Slice 2 → back to Explore. 16-05's path. */
async function switchToSibling(page) {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height })
  await page.getByRole('tab', { name: /Conversations/i }).click()
  await page.waitForTimeout(600)
  await page.locator('button[aria-haspopup="listbox"]').first().click()
  await page.waitForTimeout(400)
  await page.locator('[role="option"]').filter({ hasText: 'Slice 2' }).first().click()
  await page.waitForTimeout(900)
  await page.getByRole('tab', { name: /Explore/i }).click()
  await page.waitForTimeout(1200)
  const onSibling = await page.evaluate(
    (sel) => !!document.querySelector(`${sel} [data-explore-view-only-notice]`),
    PANEL,
  )
  if (!onSibling) throw new Error('switch to Slice 2 did not reach the view-only state')
}

/**
 * One cell: the whole document as one strip, then viewport frames walking down
 * it. The strip answers "is this mostly empty rooms"; the frames are the only
 * ones small print is legible in.
 */
async function shootCell(page, cell, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.waitForTimeout(700)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  const seen = await page.evaluate(readSeen, PANEL)

  await page.screenshot({ path: `${OUT}/${cell}-full.png`, fullPage: true })
  written.push(`${cell}-full.png`)

  const frames = Math.min(14, Math.max(1, Math.ceil(seen.docHeight / vp.height)))
  for (let i = 0; i < frames; i += 1) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vp.height)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${cell}-f${i + 1}.png` })
    written.push(`${cell}-f${i + 1}.png`)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  return { ...seen, frames }
}

function reportCell(cell, seen) {
  console.log(`  ${cell}`)
  // 🔴 A cell with no Explore panel is a finding, not a crash. Group B's whole
  // point is that the signed-out branch is a DIFFERENT render path, and a reader
  // needs to be told it had no Explore rather than handed a stack trace.
  if (seen.missing || seen.hidden) {
    console.log(`      🔴 Explore panel ${seen.missing ? 'MISSING from the DOM' : 'present but HIDDEN'} — nothing of Explore is in this image`)
    console.log(`      body     "${(seen.bodyText || '').slice(0, 140)}"`)
    return
  }
  console.log(`      modules  [${seen.modules.join(', ')}]${seen.scope === 'panel' ? '' : `  (scope: ${seen.scope})`}`)
  console.log(
    `      rooms    ${seen.rooms.length} in ${seen.roomCards.length} card(s)` +
      `${seen.roomCards.length ? ` (${seen.roomCards.join(', ')})` : ''}` +
      `${seen.rooms.length ? `: ${seen.rooms.join(', ')}` : ''}`,
  )
  console.log(
    `      agenda   ${seen.agendaRendered ? `rendered, ${seen.agendaItems} item(s)` : 'not rendered'}` +
      `${seen.agendaLead ? ` — "${seen.agendaLead.slice(0, 78)}"` : ''}`,
  )
  console.log(`      h1       "${seen.firstHeading}"`)
  console.log(
    `      scrollY  ${seen.scrollY} on arrival · doc ${seen.docHeight}px · panel ${seen.panelHeight}px` +
      ` · ${seen.frames} frame(s)` +
      `${seen.viewOnlyNotice ? ' · VIEW-ONLY NOTICE PRESENT' : ''}`,
  )
}

// ── Group A ──────────────────────────────────────────────────────────────────

for (const group of GROUP_A) {
  console.log(`\n── ${group.label} ${'─'.repeat(Math.max(2, 60 - group.label.length))}`)

  for (const theme of THEMES) {
    // One context per theme rather than one per group: the theme is read before
    // first paint, and a reload is the honest way to prove the cookie path works
    // rather than only the class toggle. The class is still asserted below.
    const { ctx, page } = await openGroup(group, group.tabs[0], theme)
    await setTheme(page, theme)
    if (group.viewOnly) await switchToSibling(page)

    for (const tab of group.tabs) {
      if (!group.viewOnly || tab !== group.tabs[0]) {
        // view-only already sits on City; re-clicking the rail would reset it.
        if (!group.viewOnly) await clickTab(page, tab)
      }
      // The theme survives a tab switch (it is a class on <html>), but assert it
      // again rather than trust it — this is the exact thing that silently halves
      // a four-way run.
      await setTheme(page, theme)

      for (const vp of VIEWPORTS) {
        const cell = `${group.key}-${tab}-${theme}-${vp.name}`
        const seen = await shootCell(page, cell, vp)
        if (seen.missing || seen.hidden) {
          notes.push(`${cell}: Explore panel ${seen.missing ? 'MISSING' : 'HIDDEN'} — nothing was shot of Explore`)
        }
        reportCell(cell, seen)
      }
    }
    await ctx.close()
  }
}

// ── Group B — opt-in, and a skip is not a pass ───────────────────────────────

/**
 * Detected, not assumed. The signed-out branch needs VITE_SUPABASE_URL in
 * .env.local AND no cs_token; with neither, useAuth enters dev-guest mode
 * unconditionally and this would shoot the dev-guest page under a "signed out"
 * filename — a label that is simply false.
 */
function groupBConfigured() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue
    try {
      const body = readFileSync(f, 'utf8')
      if (/^\s*VITE_SUPABASE_URL\s*=\s*\S/m.test(body)) return f
    } catch {
      // Unreadable is the same as unconfigured for our purposes, and saying so
      // is better than guessing.
      return null
    }
  }
  return null
}

const envFile = groupBConfigured()
let groupBRan = false

if (!envFile) {
  console.log(`\n── Signed out ${'─'.repeat(48)}`)
  console.log(`  SKIPPED — ${SKIP_LINE}`)
} else {
  console.log(`\n── Signed out — VITE_SUPABASE_URL found in ${envFile} ${'─'.repeat(14)}`)
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 })
    await ctx.addCookies([{ name: 'ev_theme', value: theme, domain: 'localhost', path: '/' }])
    const page = await ctx.newPage()
    attachErrorSinks(page)
    // No cs_token, no ?dev=1 — the two conditions together are what reaches
    // AppShell's signed-out branch.
    await page.addInitScript(() => {
      localStorage.removeItem('cs_token')
      localStorage.setItem('cs_active_tab', 'city')
    })
    await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5000)
    await setTheme(page, theme)
    /**
     * 🔴 Proven, not assumed, and a missing token is NOT enough on its own: with
     * no VITE_SUPABASE_URL the app enters dev-guest mode with no token either,
     * and these files would carry a "signed out" name over the dev-guest page.
     * The sign-in call to action only exists on AppShell's signed-out branch, so
     * it is the evidence that this really is that branch.
     */
    const proof = await page.evaluate(() => ({
      noToken: !localStorage.getItem('cs_token'),
      signInCta: /Log in with Empowered Vote/.test(document.body.innerText || ''),
      noForumTabs: document.querySelectorAll('[role="tab"]').length === 0,
    }))
    if (!proof.noToken || !proof.signInCta || !proof.noForumTabs) {
      notes.push(`group B: NOT the signed-out branch — ${JSON.stringify(proof)}`)
    }
    for (const vp of VIEWPORTS) {
      const cell = `signedout-place-${theme}-${vp.name}`
      const seen = await shootCell(page, cell, vp)
      reportCell(cell, seen)
    }
    await ctx.close()
    groupBRan = true
  }
}

await browser.close()

// ── The summary ──────────────────────────────────────────────────────────────

const fulls = written.filter((f) => f.endsWith('-full.png'))
const groupAFulls = fulls.filter((f) => !f.startsWith('signedout-'))

console.log(`\n${'═'.repeat(72)}`)
console.log(`Group A: ${groupAFulls.length} presentations, ${written.filter((f) => !f.startsWith('signedout-')).length} PNGs in ${OUT}/`)
if (groupBRan) {
  console.log(`Group B: 4 presentations, ${written.filter((f) => f.startsWith('signedout-')).length} PNGs`)
} else {
  console.log('Group B: 🔴 SKIPPED — 0 of 4. THIS IS NOT A PASS.')
  console.log(`  ${SKIP_LINE}`)
  console.log('  The four presentations NOT covered by this run:')
  for (const c of GROUP_B_CELLS) console.log(`    - ${c}`)
  console.log('  Do not report this run as a complete four-way pass.')
}

if (errors.noise.length) {
  console.log(
    `\n(noise) ${errors.noise.length} expected dev-id network errors suppressed: ` +
      [...new Set(errors.noise)].map((t) => t.slice(0, 60)).join(' | '),
  )
}
if (errors.page.length || errors.console.length) {
  console.log(`\n🔴 ${errors.page.length} page error(s), ${errors.console.length} unexpected console error(s):`)
  for (const e of [...errors.page, ...errors.console].slice(0, 6)) console.log(`  ${e.slice(0, 200)}`)
} else {
  console.log('\nZero page errors, zero unexpected console errors.')
}
for (const n of notes) console.log(`🔴 ${n}`)

console.log(`\n🔴 NOW LOOK AT THEM. ${OUT}/*-full.png is the whole column (composition);`)
console.log('   *-fN.png are viewport frames walking down it, and are the only ones')
console.log('   small print is legible in. A clean run only proves the pixels decoded.')

// A missing panel or an unexpected error is a real failure; a group-B skip is a
// documented gap, not a crash, and exiting non-zero on it would make the
// documented path look broken.
process.exit(notes.length || errors.page.length || errors.console.length ? 1 : 0)
