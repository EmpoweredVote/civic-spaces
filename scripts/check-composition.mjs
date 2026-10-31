#!/usr/bin/env node
/**
 * check-composition.mjs — the pure check for Explore's per-slice composition.
 *
 * Run: npm run check:composition        (no network, no credential, < 1s)
 *
 * 🔴 This imports the SHIPPED src/lib/exploreComposition.ts, not a transcription of it.
 * `node --experimental-strip-types` erases the type annotations and runs the real source.
 * That matters: a check that re-implements the functions it checks passes while the
 * shipped code is wrong. If you are tempted to copy a function in here, don't — make the
 * function importable instead.
 *
 * What it covers (57 assertions, extended to 62 by 16-08;
 * 16-10 re-runs it as a phase gate):
 *
 *   1–8    composition keys and the five module lists
 *   9–21   draft keys, parsing, and canPostDraft — the "a post must not land in the wrong
 *          jurisdiction" anti-goal, as a function rather than a UI behaviour
 *   42–47  the sign-in re-key (migrateSignedOutDrafts). Numbered after the fact but run
 *          here, with the rest of the draft-key work they belong to
 *   48–55  shouldResume — the resume decision, including the view-only branch. 🔴 This is
 *          the ONLY place that branch is reachable: viewingSlices is not persisted, so a
 *          page load always starts with view-only false and no browser check can set up
 *          the state. scripts/check-explore-gate.mjs covers the invariant instead.
 *   22–30  selection against the module list, Compass ranking, the level filter
 *   31–39  resolution, races areas, href validation
 *   56–57  the geoid stamp on a bespoke topic — fetch by name, attach by geoid
 *   40–41  the same functions over THIS APP'S REAL DATA — the generic pool, the module-owned
 *          topic sets and the dev Compass fixture. 22–30 use synthetic inputs, which prove
 *          the functions behave but not that they behave on the content we ship.
 *
 * A FAIL is a bug in the shipped module or in the data it runs over. It is not a bug in
 * this script; there is nothing else here for it to be.
 */

import {
  DEFAULT_MODULES,
  MIN_RANKED,
  canPostDraft,
  compositionKey,
  draftKey,
  isHttpUrl,
  levelFilterReason,
  levelFor,
  migrateSignedOutDrafts,
  parseDraftKey,
  racesAreaFor,
  rankByCompass,
  resolveComposition,
  selectForModules,
  shouldResume,
  topicsClaimedByModules,
  topicsForLevel,
} from '../src/lib/exploreComposition.ts'
import {
  ADVENTURE_TOPICS,
  GENERIC_TOPICS,
  IMAGINE_TOPICS,
} from '../src/mocks/civicSpacesExplore.ts'
import { MOCK_COMPASS_ANSWERS, MOCK_COMPASS_TOPICS } from '../src/lib/devMockData.ts'
import { readFileSync } from 'node:fs'
import {
  PUBLIC_FEED_COLUMNS,
  PUBLIC_POST_COLUMNS,
  PUBLIC_REPLY_COLUMNS,
  authorPresentation,
  mapPublicPostRow,
  mapPublicReplyRow,
} from '../src/lib/publicProjection.ts'

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function check(n, label, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`PASS ${String(n).padStart(2)}  ${label}`)
  } else {
    failed += 1
    console.log(`FAIL ${String(n).padStart(2)}  ${label}${detail === undefined ? '' : `\n          ${detail}`}`)
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ids = (list) => list.map((t) => t.id)

/**
 * 🔴 Snapshotted HERE, at module load, before a single resolveComposition call.
 *
 * Checks 34 and 62 both assert the frozen table is unmutated, and both are
 * worthless if their baseline is taken after the mutation. 16-08 proved that:
 * pointing resolveComposition's `modules` at DEFAULT_MODULES[level] instead of a
 * copy mutated the table during check 58, so a baseline taken at check 62 was
 * already the mutated value and 62 passed a build that was leaking the reorder
 * into every slice on the page. One load-time baseline, shared, is the fix.
 */
const MODULES_AT_LOAD = JSON.stringify(DEFAULT_MODULES)

function topic(id, level, extra = {}) {
  return {
    id,
    category: 'Check',
    title: id,
    summary: '',
    question: '',
    suggestedTitle: id,
    level,
    geoid: null,
    provenance: 'staff',
    ...extra,
  }
}

// The real local-only Compass id, read off the committed fixture rather than typed here.
// A made-up id would make checks 28–29 pass against a filter that does nothing.
const localOnly = MOCK_COMPASS_TOPICS.find(
  (t) => t.applies_local && !t.applies_federal && !t.applies_state,
)
if (!localOnly) {
  console.error(
    'FATAL: no local-only topic in MOCK_COMPASS_TOPICS. Checks 28-29 would be vacuous.\n' +
      '       Re-read GET /api/compass/topics and restore one (16-01 Task 4).',
  )
  process.exit(1)
}
const COMPASS_FLAGS = new Map(
  MOCK_COMPASS_TOPICS.map((t) => [
    t.id,
    { federal: !!t.applies_federal, state: !!t.applies_state, local: !!t.applies_local },
  ]),
)

console.log(`check-composition — against src/lib/exploreComposition.ts itself`)
console.log(`local-only Compass topic used for 28-29: ${localOnly.short_title} (${localOnly.id})\n`)

// ── 1–8  Keys and levels ─────────────────────────────────────────────────────

check(
  1,
  "compositionKey('federal','3711') === ('federal','US') — fixture and production resolve one composition",
  compositionKey('federal', '3711') === compositionKey('federal', 'US'),
  `${compositionKey('federal', '3711')} vs ${compositionKey('federal', 'US')}`,
)
check(
  2,
  "compositionKey('unified','') === ('unified','UNIFIED')",
  compositionKey('unified', '') === compositionKey('unified', 'UNIFIED'),
  `${compositionKey('unified', '')} vs ${compositionKey('unified', 'UNIFIED')}`,
)
check(
  3,
  'compositionKey distinguishes two cities — Bloomington is not Los Angeles',
  compositionKey('city', '1805860') !== compositionKey('city', '0644000'),
)
{
  // Two sibling shards of one jurisdiction: different slice ids, same type and geoid.
  const shardA = { id: 'slice-la-1', sliceType: 'city', geoid: '0644000' }
  const shardB = { id: 'slice-la-2', sliceType: 'city', geoid: '0644000' }
  check(
    4,
    'two sibling shards of one jurisdiction resolve one key (slice id is not an input)',
    compositionKey(shardA.sliceType, shardA.geoid) === compositionKey(shardB.sliceType, shardB.geoid),
  )
}
check(5, "levelFor('volunteer') is null — Volunteer keeps no Explore", levelFor('volunteer') === null)

{
  const levels = ['city', 'county', 'state', 'federal', 'unified']
  const problems = []
  for (let i = 0; i < levels.length; i += 1) {
    for (let j = i + 1; j < levels.length; j += 1) {
      const a = levels[i]
      const b = levels[j]
      const setA = new Set(DEFAULT_MODULES[a])
      const setB = new Set(DEFAULT_MODULES[b])
      const onlyA = [...setA].filter((m) => !setB.has(m))
      const onlyB = [...setB].filter((m) => !setA.has(m))
      const identical = onlyA.length === 0 && onlyB.length === 0
      if (a === 'city' && b === 'county') {
        if (!same(DEFAULT_MODULES.city, DEFAULT_MODULES.county)) problems.push('city !== county')
      } else if (identical) {
        problems.push(`${a} and ${b} differ only in order, not membership`)
      }
    }
  }
  check(
    6,
    'the five DEFAULT_MODULES lists pairwise: city === county, every other pair differs in MEMBERSHIP',
    problems.length === 0,
    problems.join('; '),
  )
}
{
  const f = new Set(DEFAULT_MODULES.federal)
  check(
    7,
    'DEFAULT_MODULES.federal has no imagine / nearby / agenda, and DOES have featured',
    !f.has('imagine') && !f.has('nearby') && !f.has('agenda') && f.has('featured'),
    [...f].join(', '),
  )
}
{
  const u = new Set(DEFAULT_MODULES.unified)
  check(
    8,
    'DEFAULT_MODULES.unified has no races / coming-up / agenda',
    !u.has('races') && !u.has('coming-up') && !u.has('agenda'),
    [...u].join(', '),
  )
}

// ── 9–21  Draft keys and the post guard ──────────────────────────────────────

check(9, "draftKey('city','1805860','x') !== ('state','18','x')", draftKey('city', '1805860', 'x') !== draftKey('state', '18', 'x'))
check(10, "draftKey('city','1805860','x') !== ('city','0644000','x')", draftKey('city', '1805860', 'x') !== draftKey('city', '0644000', 'x'))
check(
  11,
  "draftKey('federal','3711','x') === ('federal','US','x') — placeless types collapse",
  draftKey('federal', '3711', 'x') === draftKey('federal', 'US', 'x'),
)
check(
  12,
  "parseDraftKey(draftKey('city','1805860','x')) round-trips",
  same(parseDraftKey(draftKey('city', '1805860', 'x')), { sliceType: 'city', geoid: '1805860', topicId: 'x' }),
  JSON.stringify(parseDraftKey(draftKey('city', '1805860', 'x'))),
)
check(
  13,
  "parseDraftKey(draftKey('federal','US','x')) gives geoid null",
  same(parseDraftKey(draftKey('federal', 'US', 'x')), { sliceType: 'federal', geoid: null, topicId: 'x' }),
  JSON.stringify(parseDraftKey(draftKey('federal', 'US', 'x'))),
)
check(
  14,
  "parseDraftKey('city||x') — the signed-out shape — gives geoid null, NOT ''",
  parseDraftKey('city||x')?.geoid === null && parseDraftKey('city||x')?.topicId === 'x',
  JSON.stringify(parseDraftKey('city||x')),
)
check(
  15,
  "parseDraftKey('') and parseDraftKey('garbage') return null rather than throwing",
  parseDraftKey('') === null && parseDraftKey('garbage') === null,
)
{
  const r = canPostDraft('city|1805860|x', { city: { id: 's1', geoid: '1805860' } })
  check(16, 'canPostDraft accepts a draft for the slice the member still holds', r.ok === true && r.sliceId === 's1', JSON.stringify(r))
}
{
  const r = canPostDraft('city|1805860|x', { city: { id: 's1', geoid: '0644000' } })
  check(17, "canPostDraft refuses a moved member with reason 'moved'", r.ok === false && r.reason === 'moved', JSON.stringify(r))
}
{
  const r = canPostDraft('city|1805860|x', {})
  check(18, "canPostDraft refuses with 'no-slice' when the member holds none of that type", r.ok === false && r.reason === 'no-slice', JSON.stringify(r))
}
{
  const r = canPostDraft('city||x', { city: { id: 's1', geoid: '1805860' } })
  check(19, 'canPostDraft ACCEPTS a signed-out draft — it binds to whatever they hold for that type', r.ok === true && r.sliceId === 's1', JSON.stringify(r))
}
{
  const r = canPostDraft('federal|x', { federal: { id: 'f1', geoid: 'US' } })
  check(20, 'canPostDraft accepts a placeless draft', r.ok === true && r.sliceId === 'f1', JSON.stringify(r))
}
{
  const r = canPostDraft('nonsense', { city: { id: 's1', geoid: '1805860' } })
  check(21, "canPostDraft refuses an unparseable key with reason 'unparseable'", r.ok === false && r.reason === 'unparseable', JSON.stringify(r))
}

// ── 42–47  The sign-in re-key ────────────────────────────────────────────────
//
// Numbered out of order on purpose: these belong with 9–21 by subject, and after
// them by history. A draft typed signed out has no geoid; on sign-in it must move
// onto the slice the member actually holds, or it is invisible forever to every
// reader built on the new key.

{
  const r = migrateSignedOutDrafts({ 'city||t': { updatedAt: 5 } }, { city: { geoid: '1805860' } })
  check(
    42,
    "migrateSignedOutDrafts binds 'city||t' to the member's city slice",
    r.changed === true && !!r.next['city|1805860|t'] && r.next['city||t'] === undefined,
    JSON.stringify(r),
  )
}
{
  const same = migrateSignedOutDrafts({ 'city|1805860|t': { updatedAt: 5 } }, { city: { geoid: '1805860' } })
  // 🔴 The half that matters: a draft bound to a city the member has LEFT must not be
  // re-pointed at the one they hold now. That is the phase's loudest anti-goal arriving
  // as a storage write rather than as a button, and the "already bound" guard is the
  // only thing standing in front of it — a version that re-keys every null-geoid key
  // passes the equal-geoid case above and fails this one.
  const moved = migrateSignedOutDrafts({ 'city|0644000|t': { updatedAt: 5 } }, { city: { geoid: '1805860' } })
  check(
    43,
    'a key that already carries a geoid is left alone — including one for a city the member has LEFT',
    same.changed === false &&
      !!same.next['city|1805860|t'] &&
      Object.keys(same.next).length === 1 &&
      moved.changed === false &&
      !!moved.next['city|0644000|t'] &&
      moved.next['city|1805860|t'] === undefined,
    JSON.stringify({ same, moved }),
  )
}
{
  const r = migrateSignedOutDrafts({ 'federal|t': { updatedAt: 5 } }, { federal: { geoid: 'US' } })
  check(
    44,
    "a placeless key ('federal|t') is left alone — its null geoid means no place, not unbound",
    r.changed === false && !!r.next['federal|t'] && Object.keys(r.next).length === 1,
    JSON.stringify(r),
  )
}
{
  const r = migrateSignedOutDrafts({ 'county||t': { updatedAt: 5 } }, { city: { geoid: '1805860' } })
  check(
    45,
    'a null-geoid key whose type the member has no slice for is left alone, NOT deleted',
    r.changed === false && !!r.next['county||t'] && Object.keys(r.next).length === 1,
    JSON.stringify(r),
  )
}
{
  const r = migrateSignedOutDrafts(
    { 'city||t': { updatedAt: 200 }, 'city|1805860|t': { updatedAt: 100 } },
    { city: { geoid: '1805860' } },
  )
  const keys = Object.keys(r.next)
  check(
    46,
    'a collision keeps the NEWER draft at the bound key, and leaves one entry rather than two',
    r.changed === true && keys.length === 1 && keys[0] === 'city|1805860|t' && r.next['city|1805860|t'].updatedAt === 200,
    JSON.stringify(r),
  )
}
{
  const r = migrateSignedOutDrafts({}, { city: { geoid: '1805860' } })
  check(
    47,
    'no drafts: changed is false, so the caller never writes',
    r.changed === false && Object.keys(r.next).length === 0,
    JSON.stringify(r),
  )
}

// ── 48–55  The resume decision ───────────────────────────────────────────────
//
// 🔴 The view-only branch (52, 55) is unreachable from a browser: viewingSlices is
// plain useState and is not persisted, so a page load always starts with view-only
// false, and the resume effect fires once per mount before any async deep-link
// resolution can set it. That is exactly why the decision is a pure function. If
// these go red, so has the last gate standing between a replayed resume marker and
// an insert RLS will reject.

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

/** Everything valid: a fresh marker, a draft, a destination, postable, own shard. */
const resumeInput = (over = {}) => ({
  marker: { sliceType: 'city', geoid: '1805860', topicId: 'safer-walking', at: NOW - 60_000 },
  draft: { updatedAt: NOW - 60_000 },
  now: NOW,
  maxAgeMs: DAY,
  isViewOnly: false,
  hasDestination: true,
  postVerdict: { ok: true },
  ...over,
})

check(48, "no marker yields 'none'", shouldResume(resumeInput({ marker: null })) === 'none', shouldResume(resumeInput({ marker: null })))
check(
  49,
  "a fresh marker with a draft, postable, not view-only, with a destination yields 'resume'",
  shouldResume(resumeInput()) === 'resume',
  shouldResume(resumeInput()),
)
{
  const got = shouldResume(resumeInput({ marker: { sliceType: 'city', geoid: '1805860', topicId: 'safer-walking', at: NOW - DAY - 1 } }))
  check(50, "a marker older than maxAgeMs yields 'drop-stale'", got === 'drop-stale', got)
}
{
  const got = shouldResume(resumeInput({ draft: undefined }))
  check(51, "a marker with NO draft yields 'drop-stale' — it points at nothing", got === 'drop-stale', got)
}
{
  const got = shouldResume(resumeInput({ isViewOnly: true }))
  check(
    52,
    "🔴 view-only with everything else valid yields 'defer' — the marker is KEPT, not dropped",
    got === 'defer',
    `${got}\n          Dropping it would throw away the member's stated intent to post. They are` +
      `\n          merely reading someone else's shard; the marker fires when they switch back.`,
  )
}
{
  const got = shouldResume(resumeInput({ hasDestination: false }))
  check(53, "no destination yet yields 'defer' — later, not never", got === 'defer', got)
}
{
  const got = shouldResume(resumeInput({ postVerdict: { ok: false } }))
  check(
    54,
    "canPostDraft refusing yields 'drop-unpostable' — the marker goes, the draft stays",
    got === 'drop-unpostable',
    got,
  )
}
{
  const got = shouldResume(
    resumeInput({
      isViewOnly: true,
      marker: { sliceType: 'city', geoid: '1805860', topicId: 'safer-walking', at: NOW - DAY - 1 },
    }),
  )
  check(
    55,
    "🔴 view-only AND stale yields 'drop-stale' — staleness is tested FIRST",
    got === 'drop-stale',
    `${got}\n          If this says 'defer' the branches are in the wrong order. A marker older than` +
      `\n          24 h was abandoned, and a deferred marker is only re-evaluated on switch-back or` +
      `\n          a remount — so keeping it alive would park stale state indefinitely, outliving` +
      `\n          the draft it points at.`,
  )
}

// ── 22–30  Selection, ranking, the level filter ──────────────────────────────

{
  const topics = [topic('t1', 'city'), topic('t2', 'city'), topic('t3', 'city')]
  const r = selectForModules(topics, ['intro', 'questions', 'whats-new'])
  check(
    22,
    'selectForModules with NO featured module: featured is null and topic[0] is still a question, not dropped',
    r.featuredTopicId === null && r.questionTopicIds.includes('t1'),
    JSON.stringify(r),
  )
}
{
  const agenda = [
    topic('a1', 'city', { provenance: 'derived-from-agenda' }),
    topic('a2', 'city', { provenance: 'derived-from-agenda' }),
  ]
  const generic = [topic('g1', 'city'), topic('g2', 'city'), topic('g3', 'city')]
  const topics = [...agenda, ...generic]
  const r = selectForModules(topics, DEFAULT_MODULES.city)
  const touched = [r.featuredTopicId, ...r.questionTopicIds]
  check(
    23,
    'selectForModules: the agenda module OWNS derived-from-agenda topics — none is featured or a question',
    !touched.includes('a1') && !touched.includes('a2') && r.featuredTopicId === 'g1',
    JSON.stringify(r),
  )
  const claimed = topicsClaimedByModules(topics, DEFAULT_MODULES.city)
  const union = [r.featuredTopicId, ...r.questionTopicIds, ...claimed].filter((x) => x !== null)
  check(
    24,
    'union of featured + questions + agenda-claimed has no duplicates — a topic appears in exactly one module',
    new Set(union).size === union.length,
    union.join(', '),
  )
}
{
  const topics = [
    topic('r1', 'city', { compassTopicId: 'c-unanswered-1' }),
    topic('r2', 'city', { compassTopicId: 'c-answered-1' }),
    topic('r3', 'city'),
    topic('r4', 'city', { compassTopicId: 'c-answered-2' }),
  ]
  const answered = new Set(['c-answered-1', 'c-answered-2', 'c-answered-3'])
  const ranked = rankByCompass(topics, answered)
  const isPermutation =
    ranked.length === topics.length && same([...ids(ranked)].sort(), [...ids(topics)].sort())
  check(
    25,
    `rankByCompass at or above MIN_RANKED (${MIN_RANKED}) returns a PERMUTATION — nothing added, nothing dropped`,
    isPermutation && same(ids(ranked), ['r2', 'r4', 'r1', 'r3']),
    ids(ranked).join(', '),
  )
  const tooFew = rankByCompass(topics, new Set(['c-answered-1']))
  check(
    26,
    'rankByCompass below MIN_RANKED returns the input unchanged, in source order',
    same(ids(tooFew), ids(topics)),
    ids(tooFew).join(', '),
  )
  const twice = rankByCompass(topics, answered)
  const ties = rankByCompass(
    [topic('s1', 'city'), topic('s2', 'city'), topic('s3', 'city')],
    answered,
  )
  check(
    27,
    'rankByCompass is stable: equal relevance keeps source order, and two runs are identical',
    same(ids(ranked), ids(twice)) && same(ids(ties), ['s1', 's2', 's3']),
    `${ids(twice).join(', ')} | ${ids(ties).join(', ')}`,
  )
}
{
  // Deliberately level 'federal' with a real LOCAL-ONLY compass id: topicsForLevel filters on
  // topic.level FIRST, so a level:'city' topic would already be gone before the flags were
  // consulted and would pass this check with the flag logic deleted.
  const t = topic('fed-with-local-only-compass', 'federal', { compassTopicId: localOnly.id })
  check(
    28,
    'topicsForLevel EXCLUDES a federal-level topic whose real Compass id is local-only, and says why',
    topicsForLevel([t], 'federal', COMPASS_FLAGS).length === 0 &&
      levelFilterReason(t, 'federal', COMPASS_FLAGS) === 'compass-level-flag',
    String(levelFilterReason(t, 'federal', COMPASS_FLAGS)),
  )
  check(
    29,
    "the same topic asked for level 'city' is excluded too — by topic.level, reason 'level-mismatch'",
    topicsForLevel([t], 'city', COMPASS_FLAGS).length === 0 &&
      levelFilterReason(t, 'city', COMPASS_FLAGS) === 'level-mismatch',
    String(levelFilterReason(t, 'city', COMPASS_FLAGS)),
  )
  const cityTopics = [
    topic('c1', 'city', { compassTopicId: localOnly.id }),
    topic('c2', 'city'),
    topic('c3', 'state'),
  ]
  check(
    30,
    'topicsForLevel with no flags map lets every topic of that level through',
    same(ids(topicsForLevel(cityTopics, 'city')), ['c1', 'c2']),
    ids(topicsForLevel(cityTopics, 'city')).join(', '),
  )
}

// ── 31–39  Resolution and areas ──────────────────────────────────────────────

// Kept as a name for readability; the baseline is the LOAD-TIME one. See MODULES_AT_LOAD.
const MODULES_BEFORE = MODULES_AT_LOAD

{
  const bespoke = [topic('b1', 'city', { provenance: 'derived-from-agenda', geoid: '1805860' })]
  const c = resolveComposition({
    sliceType: 'city',
    geoid: '1805860',
    generic: GENERIC_TOPICS.city,
    bespoke,
  })
  check(
    31,
    'resolveComposition with bespoke topics: isUnseeded false, bespoke first',
    c !== null && c.isUnseeded === false && c.topics[0].id === 'b1',
    c === null ? 'null' : `${c.isUnseeded} / ${ids(c.topics).slice(0, 3).join(', ')}`,
  )
}
{
  const c = resolveComposition({ sliceType: 'city', geoid: null, generic: GENERIC_TOPICS.city })
  check(
    32,
    'resolveComposition with geoid null: isUnseeded false (nobody can seed a place the app cannot name), generic only',
    c !== null && c.isUnseeded === false && same(ids(c.topics).sort(), ids(GENERIC_TOPICS.city).sort()),
    c === null ? 'null' : `${c.isUnseeded} / ${ids(c.topics).join(', ')}`,
  )
}
check(
  33,
  "resolveComposition for sliceType 'volunteer' is null",
  resolveComposition({ sliceType: 'volunteer', geoid: '', generic: [] }) === null,
)
{
  for (const [sliceType, geoid] of [
    ['city', '1805860'],
    ['county', '18105'],
    ['state', '18'],
    ['federal', '3711'],
    ['unified', ''],
  ]) {
    const level = levelFor(sliceType)
    resolveComposition({ sliceType, geoid, generic: level ? GENERIC_TOPICS[level] : [] })
  }
  check(
    34,
    'DEFAULT_MODULES is unmutated after resolving every level',
    JSON.stringify(DEFAULT_MODULES) === MODULES_BEFORE,
  )
}
check(
  35,
  'racesAreaFor prefers the CITY area when the member has one',
  same(racesAreaFor({ city: { geoid: '1805860' }, county: { geoid: '18105' }, state: { geoid: '18' } }), {
    geoid: '1805860',
    mtfcc: 'G4110',
  }),
  JSON.stringify(racesAreaFor({ city: { geoid: '1805860' }, county: { geoid: '18105' }, state: { geoid: '18' } })),
)
check(
  36,
  'racesAreaFor falls back to the COUNTY area',
  same(racesAreaFor({ county: { geoid: '18105' }, state: { geoid: '18' } }), { geoid: '18105', mtfcc: 'G4020' }),
  JSON.stringify(racesAreaFor({ county: { geoid: '18105' }, state: { geoid: '18' } })),
)
check(
  37,
  'racesAreaFor returns NULL for a state-only member — no state fallback, ever',
  racesAreaFor({ state: { geoid: '18' } }) === null,
  JSON.stringify(racesAreaFor({ state: { geoid: '18' } })),
)
check(
  38,
  "racesAreaFor returns null for federal 'US' / unified 'UNIFIED' — neither is a place to ask about",
  racesAreaFor({ federal: { geoid: 'US' }, unified: { geoid: 'UNIFIED' } }) === null,
)
{
  const inputs = ['https://x/y', 'http://x', 'javascript:alert(1)', '//evil.example/x', '', null]
  const got = inputs.map((v) => isHttpUrl(v))
  check(
    39,
    'isHttpUrl accepts https/http and rejects javascript:, protocol-relative, empty and null',
    same(got, [true, true, false, false, false, false]),
    got.join(', '),
  )
}

// ── 56–57  Fetch by name, attach by geoid ────────────────────────────────────
//
// 🔴 The meetings API is keyed on a city NAME plus a state abbreviation — it has
// no geoid at all — so a bespoke topic is FETCHED by name. It must not be
// ATTACHED by one: two cities of one name in one state would collide, and
// `(slice_type, geoid)` is the composition key everywhere else in this phase.
// agendaItemsToTopics stamps each topic with the SLICE's geoid; resolveComposition
// re-checks the stamp rather than trusting its caller. A collision must yield a
// place with no bespoke topics, never one city's agenda shown to another's.

{
  const stampedA = [
    topic('agenda-x', 'city', { provenance: 'derived-from-agenda', geoid: '1805860' }),
  ]
  const c = resolveComposition({
    sliceType: 'city',
    geoid: '0644000', // Los Angeles. A different place entirely.
    generic: GENERIC_TOPICS.city,
    bespoke: stampedA,
  })
  check(
    56,
    'a bespoke topic stamped with ANOTHER geoid is DISCARDED, and the composition stays unseeded',
    c !== null &&
      c.isUnseeded === true &&
      !ids(c.topics).includes('agenda-x') &&
      c.topics.every((t) => t.provenance !== 'derived-from-agenda'),
    c === null ? 'null' : `isUnseeded ${c.isUnseeded} / ${ids(c.topics).slice(0, 3).join(', ')}`,
  )
}
{
  const stampedB = [
    topic('agenda-x', 'city', { provenance: 'derived-from-agenda', geoid: '1805860' }),
  ]
  const c = resolveComposition({
    sliceType: 'city',
    geoid: '1805860',
    generic: GENERIC_TOPICS.city,
    bespoke: stampedB,
  })
  check(
    57,
    'the SAME topic stamped with this composition’s geoid is kept, leads topics, and the place is seeded',
    c !== null && c.isUnseeded === false && c.topics[0]?.id === 'agenda-x',
    c === null ? 'null' : `isUnseeded ${c.isUnseeded} / ${ids(c.topics).slice(0, 3).join(', ')}`,
  )
}

// ── 58–62  The seed invitation's position, and who is unseeded ───────────────
//
// 🔴 The module is the FIRST thing after the intro on a place with nothing in
// it, because it is the thing that explains everything below it —
// DEFAULT_MODULES lists it late, among the reserved rooms. `isUnseeded` is the
// one flag that decides, so these five pin down exactly who it is true for:
// a real place with no bespoke layer, and nobody else. A placeless level has
// one nation-wide key and nothing to seed; a viewer with no geoid cannot seed
// a place the app cannot name.

{
  const c = resolveComposition({
    sliceType: 'city',
    geoid: '3702140', // Asheville — real place, no agenda coverage, nothing bespoke.
    generic: GENERIC_TOPICS.city,
  })
  check(
    58,
    "an UNSEEDED real place leads with its invitation — modules[1] === 'seed-invitation'",
    c !== null && c.isUnseeded === true && c.modules[1] === 'seed-invitation',
    c === null ? 'null' : `isUnseeded ${c.isUnseeded} / modules ${c.modules.slice(0, 4).join(', ')}`,
  )
}
{
  const c = resolveComposition({
    sliceType: 'city',
    geoid: '1805860',
    generic: GENERIC_TOPICS.city,
    bespoke: [topic('agenda-1', 'city', { provenance: 'derived-from-agenda', geoid: '1805860' })],
  })
  // The POSITION is deliberately not asserted: with isUnseeded false the module's
  // available() is false and emptyState is 'hide', so it does not render at all
  // and where it sits in the list is not an observable property.
  check(
    59,
    'a SEEDED place is not unseeded — the invitation will not render, wherever it sits',
    c !== null && c.isUnseeded === false,
    c === null ? 'null' : `isUnseeded ${c.isUnseeded} / modules ${c.modules.slice(0, 4).join(', ')}`,
  )
}
{
  const c = resolveComposition({ sliceType: 'city', geoid: null, generic: GENERIC_TOPICS.city })
  check(
    60,
    'geoid null is NOT unseeded — nobody can seed a place the app cannot name',
    c !== null && c.isUnseeded === false && c.modules[1] !== 'seed-invitation',
    c === null ? 'null' : `isUnseeded ${c.isUnseeded} / modules ${c.modules.slice(0, 4).join(', ')}`,
  )
}
{
  // 🔴 A REAL geoid is passed, and the placeless rule must still win: federal
  // normalises to one nation-wide key, so there is no place to seed. Passing
  // null here would prove nothing that check 60 does not already prove.
  const c = resolveComposition({ sliceType: 'federal', geoid: 'US', generic: GENERIC_TOPICS.city })
  check(
    61,
    "sliceType 'federal' is NOT unseeded even with a geoid — one nation-wide key, nothing to seed",
    c !== null && c.isUnseeded === false && !c.modules.includes('seed-invitation'),
    c === null ? 'null' : `isUnseeded ${c.isUnseeded} / modules ${c.modules.slice(0, 4).join(', ')}`,
  )
}
{
  // 🔴 The reorder above SPLICES. If it ever splices the frozen table instead of
  // the copy, every later resolution on the page inherits the move — including
  // seeded places and other levels. Snapshot, resolve several times through the
  // branch that reorders, compare.
  resolveComposition({ sliceType: 'city', geoid: '3702140', generic: GENERIC_TOPICS.city })
  resolveComposition({ sliceType: 'county', geoid: '37021', generic: GENERIC_TOPICS.county ?? [] })
  resolveComposition({ sliceType: 'state', geoid: '37', generic: GENERIC_TOPICS.state ?? [] })
  resolveComposition({ sliceType: 'federal', geoid: 'US', generic: GENERIC_TOPICS.federal ?? [] })
  resolveComposition({
    sliceType: 'city',
    geoid: '1805860',
    generic: GENERIC_TOPICS.city,
    bespoke: [topic('agenda-1', 'city', { provenance: 'derived-from-agenda', geoid: '1805860' })],
  })
  const after = JSON.stringify(DEFAULT_MODULES)
  check(
    62,
    'DEFAULT_MODULES is UNMUTATED after five resolutions, including the ones that reorder',
    // 🔴 Against the LOAD-TIME baseline, not one taken here: check 58 above
    // already resolved an unseeded city, so a snapshot taken at the top of this
    // block would contain the leak and compare it to itself.
    after === MODULES_AT_LOAD,
    `at load: ${MODULES_AT_LOAD}\n          now:     ${after}`,
  )
}

// ── 40–41  Over this app's real data ─────────────────────────────────────────

{
  const sets = {
    'GENERIC_TOPICS.city': new Set(ids(GENERIC_TOPICS.city)),
    IMAGINE_TOPICS: new Set(ids(IMAGINE_TOPICS)),
    ADVENTURE_TOPICS: new Set(ids(ADVENTURE_TOPICS)),
  }
  const names = Object.keys(sets)
  const overlaps = []
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const shared = [...sets[names[i]]].filter((id) => sets[names[j]].has(id))
      if (shared.length) overlaps.push(`${names[i]} ∩ ${names[j]} = ${shared.join(', ')}`)
    }
  }
  check(
    40,
    'the generic City pool, IMAGINE_TOPICS and ADVENTURE_TOPICS are pairwise DISJOINT — no topic renders in two modules',
    overlaps.length === 0,
    overlaps.join(' | '),
  )
}
{
  const answered = new Set(MOCK_COMPASS_ANSWERS.map((a) => a.topic_id))
  const source = ids(GENERIC_TOPICS.city)
  const ranked = ids(rankByCompass(GENERIC_TOPICS.city, answered))
  const permutation = ranked.length === source.length && same([...ranked].sort(), [...source].sort())
  const reordered = !same(ranked, source)
  check(
    41,
    'rankByCompass over the REAL generic City topics and the REAL fixture answers reorders them, and is a permutation',
    permutation && reordered,
    `source:  ${source.join(', ')}\n          ranked:  ${ranked.join(', ')}\n` +
      `          If this is red the mapping is wrong, not the check: every City topic was mapped to an\n` +
      `          answered Compass id, or none was, so the ranking is a no-op on real data while passing\n` +
      `          every synthetic check above. Fix src/mocks/civicSpacesExplore.ts.`,
  )
}

// ── 63–72  Phase 18-03: the public RPC row → PostWithAuthor mapping ──────────
//
// 🔴 These run the SHIPPED src/lib/publicProjection.ts, for the same reason every
// other section here does: a transcribed mapper passes while the real one is wrong.
//
// 🔴 63–66 are the DRIFT guards and they are the reason this section exists at all.
// The RPCs these hooks call do not exist in any database yet — 18-02's migrations are
// written and unapplied — so nothing in this repo can call one and see what comes back.
// A column renamed on the SQL side would otherwise surface as a 400 to the first
// signed-out visitor after apply. Instead the mapper declares the column list it
// expects and these assertions diff it against the migration's own RETURNS TABLE.

const PUBLIC_READ_SQL_PATH = new URL('../supabase/migrations/20261030000100_public_read.sql', import.meta.url)

/**
 * The column names in one function's `RETURNS TABLE (...)`, in order.
 * 🔴 Throws rather than returning [] when the function is not found: an extractor
 * that returns nothing makes every comparison against it vacuously true, which is
 * the failure 18-02's allowlist guard was rebuilt to avoid.
 */
function returnsTableColumns(sql, fnName) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION civic_spaces.${fnName}(`)
  if (start === -1) throw new Error(`${fnName} is not defined in the migration`)
  const rt = sql.indexOf('RETURNS TABLE (', start)
  if (rt === -1) throw new Error(`${fnName} has no RETURNS TABLE`)
  const open = rt + 'RETURNS TABLE '.length
  let depth = 0
  let end = -1
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === '(') depth++
    else if (sql[i] === ')') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error(`${fnName}'s RETURNS TABLE is unbalanced`)
  return sql
    .slice(open + 1, end)
    .split(',')
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean)
}

{
  const sql = readFileSync(PUBLIC_READ_SQL_PATH, 'utf8')
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

  for (const [num, fnName, declared] of [
    [63, 'get_public_feed', PUBLIC_FEED_COLUMNS],
    [64, 'get_public_post', PUBLIC_POST_COLUMNS],
    [65, 'get_public_replies', PUBLIC_REPLY_COLUMNS],
  ]) {
    let sqlCols = null
    let why = ''
    try { sqlCols = returnsTableColumns(sql, fnName) } catch (e) { why = e.message }
    check(
      num,
      `${fnName}: the mapper's column list matches the migration's RETURNS TABLE, in order`,
      sqlCols !== null && same(sqlCols, [...declared]),
      sqlCols === null
        ? `could not read the SQL: ${why}`
        : `SQL:    [${sqlCols.join(', ')}]\n          mapper: [${[...declared].join(', ')}]\n` +
          `          🔴 These RPCs have never been called. This diff is the only thing standing between a\n` +
          `          renamed column and a 400 shown to the first signed-out visitor after the migrations apply.`,
    )
  }

  let threw = false
  try { returnsTableColumns(sql, 'get_public_nothing') } catch { threw = true }
  check(66, 'the RETURNS TABLE extractor throws when the function is missing, rather than returning []', threw)
}

const wideRow = {
  id: 'p1', slice_id: 's1', title: 'A title', body: 'A body',
  created_at: '2026-10-31T12:00:00Z', updated_at: '2026-10-31T12:00:00Z',
  reply_count: 3,
  author_display_name: 'Ada', author_user_id: 'u-ada', author_avatar_url: 'https://x/a.png',
}
const narrowRow = { ...wideRow, id: 'p2', author_user_id: null, author_avatar_url: null }

{
  const wide = mapPublicPostRow(wideRow)
  const narrow = mapPublicPostRow(narrowRow)

  check(
    67,
    'a row with author_user_id set maps to a LINKABLE author',
    wide.user_id === 'u-ada' && wide.author.avatar_url === 'https://x/a.png' && wide.author.display_name === 'Ada',
    JSON.stringify({ user_id: wide.user_id, author: wide.author }),
  )

  check(
    68,
    '🔴 a row with author_user_id null maps to user_id null and NO avatar',
    narrow.user_id === null && narrow.author.avatar_url === null,
    `${JSON.stringify({ user_id: narrow.user_id, author: narrow.author })}\n` +
      `          Never a sentinel string and never ''. A null author id is what tells the card to render\n` +
      `          the handle as plain text: no avatar, no /profile/ link, no friend affordance.`,
  )

  check(
    69,
    "author_display_name 'Unknown' survives the mapping unchanged",
    mapPublicPostRow({ ...narrowRow, author_display_name: 'Unknown' }).author.display_name === 'Unknown',
    'the SQL COALESCEs a missing profile to Unknown; the mapper must not re-handle it and must not blank it.',
  )

  check(
    70,
    'the mapper never invents a tier, and never claims a post was not edited',
    wide.author.tier === undefined && narrow.author.tier === undefined &&
      wide.edit_history === undefined && narrow.edit_history === undefined,
    `tier: ${wide.author.tier}, edit_history: ${JSON.stringify(wide.edit_history)}\n` +
      `          The public RPCs return neither (D-31 narrow projection, D-34 withholds tier).\n` +
      `          Synthesising edit_history: [] would tell a reader "never edited" about a post we\n` +
      `          simply were not told about. undefined is the honest value and renders the same.`,
  )

  check(
    71,
    'an empty result maps to an empty page, never to undefined',
    Array.isArray([].map(mapPublicPostRow)) && [].map(mapPublicPostRow).length === 0 &&
      Array.isArray([].map(mapPublicReplyRow)),
    'a feed hook that returns undefined for an empty page breaks getNextPageParam, which reads .length.',
  )

  const reply = mapPublicReplyRow({
    id: 'r1', post_id: 'p1', parent_reply_id: 'r0', body: 'A reply',
    created_at: '2026-10-31T12:01:00Z', updated_at: '2026-10-31T12:01:00Z',
    author_display_name: 'Grace', author_user_id: null, author_avatar_url: null,
  })
  check(
    72,
    'parent_reply_id survives the public reply mapping (nesting is not flattened)',
    reply.parent_reply_id === 'r0' && reply.post_id === 'p1' && reply.user_id === null,
    JSON.stringify(reply),
  )
}

// ── 73–77  Phase 18-03: what a card may offer about an author ───────────────

{
  const anon = authorPresentation(null)
  const known = authorPresentation('u-ada')

  check(
    73,
    'a null author id offers no profile href and nothing linkable',
    anon.profileHref === null && anon.linkable === false,
    `${JSON.stringify(anon)} — and 🔴 never the STRING "null": '/profile/' + null is legal\n` +
      `          JavaScript and legal TypeScript, and it produces a link to /profile/null.`,
  )

  check(
    74,
    'a known author id offers /profile/:id and a linkable name',
    known.profileHref === '/profile/u-ada' && known.linkable === true,
    JSON.stringify(known),
  )

  check(
    75,
    '🔴 D-49: one response produces MIXED presentations, row by row',
    (() => {
      const rows = [wideRow, narrowRow, { ...wideRow, id: 'p3' }].map(mapPublicPostRow)
      const p = rows.map((r) => authorPresentation(r.user_id))
      return p[0].linkable && !p[1].linkable && p[2].linkable
    })(),
    'a friend of one author and a stranger to the next, in the same thread — the decision is\n' +
      '          per row, never per response. A mapper that hoisted it would make the whole page\n' +
      '          narrow or the whole page wide, and the wide one is a disclosure.',
  )

  check(
    76,
    'the presentation never yields an empty or whitespace href',
    authorPresentation('').profileHref === null && authorPresentation(undefined).profileHref === null,
    `'' is falsy and must take the same branch as null — a '' id would otherwise build '/profile/'.`,
  )

  /**
   * 🔴 A SOURCE SCAN, and it is here because the type system cannot do this job.
   * Widening user_id to `string | null` produced three compile errors and none of
   * them were these: string concatenation with null is legal and yields
   * '/profile/null'. So the guard is structural — the three components that render
   * an author must route through authorPresentation and never build the path.
   */
  const AUTHOR_COMPONENTS = ['PostCard.tsx', 'ReplyCard.tsx', 'ThreadView.tsx']
  const offenders = []
  for (const name of AUTHOR_COMPONENTS) {
    const src = readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8')
    for (const [i, line] of src.split('\n').entries()) {
      if (/['"`]\/profile\/['"`]\s*\+|\/profile\/\$\{/.test(line)) {
        offenders.push(`${name}:${i + 1}  ${line.trim().slice(0, 80)}`)
      }
    }
  }
  check(
    77,
    'no author component builds a /profile/ path by hand — all route through authorPresentation',
    offenders.length === 0,
    `${offenders.join('\n          ')}\n` +
      `          Each of these produces '/profile/null' for a narrow-projection row, which is a\n` +
      `          dead link offered to a reader the server deliberately did not identify the author to.`,
  )
}

// ── Result ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} PASS, ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
