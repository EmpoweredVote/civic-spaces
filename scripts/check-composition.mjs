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
 * What it covers (41 assertions, extended to 47 by 16-04, 55 by 16-05, 57 by 16-06 and
 * 62 by 16-08; 16-10 re-runs it as a phase gate):
 *
 *   1–8    composition keys and the five module lists
 *   9–21   draft keys, parsing, and canPostDraft — the "a post must not land in the wrong
 *          jurisdiction" anti-goal, as a function rather than a UI behaviour
 *   22–30  selection against the module list, Compass ranking, the level filter
 *   31–39  resolution, races areas, href validation
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
  parseDraftKey,
  racesAreaFor,
  rankByCompass,
  resolveComposition,
  selectForModules,
  topicsClaimedByModules,
  topicsForLevel,
} from '../src/lib/exploreComposition.ts'
import {
  ADVENTURE_TOPICS,
  GENERIC_TOPICS,
  IMAGINE_TOPICS,
} from '../src/mocks/civicSpacesExplore.ts'
import { MOCK_COMPASS_ANSWERS, MOCK_COMPASS_TOPICS } from '../src/lib/devMockData.ts'

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

const MODULES_BEFORE = JSON.stringify(DEFAULT_MODULES)

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

// ── Result ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} PASS, ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
