#!/usr/bin/env node
/**
 * check-explore-gate.mjs — Explore must offer no write on a sibling shard.
 *
 * Run: npm run dev, then npm run check:explore-gate [-- --port 5173]
 * No credential: it drives `?dev=1`, which opens on the reserved dev-guest id.
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
 * 11 assertions x 2 tabs. If one tab is red and the other green, read that
 * carefully: a City-only failure with Federal passing is the half-a-gate shape.
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

/** Text that can only come from a write affordance. Affordances #1, #2, #7 and #8. */
const WRITE_WORDS = 'Join the conversation|Share an idea|Discard draft|Sign in to (join|share)|Post it in .* instead'

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
    // MOCK_SLICES.city.geoid — the planted draft key must match what the effect rebuilds.
    draftKey: 'city|3702140|safer-walking',
    resume: { sliceType: 'city', geoid: '3702140', topicId: 'safer-walking' },
  },
  {
    tab: 'federal',
    hasImagine: false,
    siblingPostId: 'mock-federal-2-post-1',
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

async function bootedWithTheme(page, theme) {
  await page.waitForSelector('nav[aria-label="Civic space navigation"]', { timeout: 25000 })
  await page.waitForTimeout(2500)
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  return isDark === (theme === 'dark')
}

/** Conversations -> the slice pill -> Slice 2 -> back to Explore. */
async function switchToSibling(page) {
  await page.getByRole('tab', { name: /Conversations/i }).click()
  await page.waitForTimeout(500)
  await page.locator('button[aria-haspopup="listbox"]').first().click()
  await page.waitForTimeout(300)
  await page.locator('[role="option"]').filter({ hasText: 'Slice 2' }).first().click()
  await page.waitForTimeout(800)
  await page.getByRole('tab', { name: /Explore/i }).click()
  await page.waitForTimeout(800)
}

/** Open the featured topic — the one module EVERY level has, so one path serves both tabs. */
async function openTopic(page) {
  await page.locator(`${PANEL} [data-explore-module="featured"] button`).first().click()
  await page.waitForTimeout(700)
}

async function closeTopic(page) {
  await page.locator(PANEL).getByRole('button', { name: /^Explore$/ }).first().click()
  await page.waitForTimeout(600)
}

const read = (page) => page.evaluate(readPanel, { sel: PANEL, words: WRITE_WORDS })

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
  await switchToSibling(page)

  const list = await read(page)
  await openTopic(page)
  const topic = await read(page)
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
    // Toggle it back: it proves the control works both ways, and it leaves
    // cs_saved_adventures as it was found so the control case after the
    // switch-back is not reading state this assertion left behind.
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

    check(
      tab, 8,
      'NOT over-gated: "Save on this device" is clickable and toggles both ways, and the Imagine radios still select',
      saveHit.found &&
        saveHit.ok &&
        afterSave.pressed === 'true' &&
        /^Saved on this device$/.test(afterSave.label) &&
        afterUnsave.pressed === 'false' &&
        /^Save on this device$/.test(afterUnsave.label) &&
        after === 1 &&
        after !== before,
      `saveHit=${JSON.stringify(saveHit)} save=${JSON.stringify(afterSave)} unsave=${JSON.stringify(afterUnsave)} radio ${before} -> ${after}` +
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

    const deep = await p2.evaluate((postId) => {
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
      }
    }, spec.siblingPostId)

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
}

await browser.close()

console.log(`\n${passed} PASS, ${failed} FAIL`)
if (failed) {
  console.log(`red: ${reds.join(', ')}`)
  console.log(
    'Read WHICH TAB failed. A City-only failure with Federal green is the half-a-gate\n' +
      'shape this script exists to expose — four of the ten affordances exist only there.',
  )
}
process.exit(failed === 0 ? 0 : 1)
