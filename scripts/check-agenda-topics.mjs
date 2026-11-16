#!/usr/bin/env node
/**
 * check-agenda-topics.mjs — the derivation must quote a city, never summarise it.
 *
 * Run: npm run check:agenda-topics      (no network, no credential, < 1s)
 *
 * 🔴 This imports the SHIPPED src/lib/agendaTopics.ts, not a transcription of
 * it. `node --experimental-strip-types` erases the type annotations and runs the
 * real source. A check that re-implements the function it checks passes while
 * the shipped code is wrong.
 *
 * 🔴 It reads a FROZEN fixture (scripts/fixtures/bloomington-agenda.json), not
 * the live API. The live agenda changes every few weeks, so a network-backed
 * check would drift from green to red on the council's calendar rather than on
 * our code. What is being checked here is the MAPPING, not the coverage, and
 * the mapping must not change when Bloomington meets again.
 *
 * (check:explore-rooms handles the same rot with a SKIP. A frozen fixture is
 * the better answer here for exactly that reason: a SKIP would hide the one
 * thing standing between this code and a paraphrased civic title.)
 *
 * 🔴 Check 2 is the one that matters, and it is also checked BY EYE. Every
 * derived topic is printed in full below the results. A script can prove a
 * title is a substring of the source; only a person can notice that quoting a
 * city and summarising it have started to feel the same.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { agendaItemsToTopics, bodyNameFrom, MAX_AGENDA_TOPICS } from '../src/lib/agendaTopics.ts'
// 🔴 The SHIPPED questionsFor, for the same reason: checks 18-19 are about what
// the composer actually offers, and a transcription of it would prove nothing.
import { questionsFor } from '../src/lib/writingGuidance.ts'
import { POST_TITLE_MAX } from '../src/lib/postTitle.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(HERE, 'fixtures', 'bloomington-agenda.json'), 'utf8'))
const { meeting, items } = fixture

const GEOID = '1805860' // Bloomington, IN — the slice's geoid, stamped by the caller.
const topics = agendaItemsToTopics(items, meeting, 'city', GEOID)

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

const DISCUSSABLE = new Set(['ordinance', 'resolution'])
const qualifying = items.filter((i) => DISCUSSABLE.has(i.kind) && !!(i.summaryPlain ?? '').trim())
const byId = new Map(items.map((i) => [`agenda-${i.id}`, i]))

console.log(
  `Fixture: ${meeting.date}, ${items.length} items, ${qualifying.length} qualifying ` +
    `(ordinance|resolution with a summary). Derived ${topics.length}.\n`,
)

// ── 1  Count ─────────────────────────────────────────────────────────────────

check(
  1,
  `the derived count equals the qualifying count, capped at ${MAX_AGENDA_TOPICS}`,
  topics.length === Math.min(qualifying.length, MAX_AGENDA_TOPICS),
  `derived ${topics.length}, qualifying ${qualifying.length}, cap ${MAX_AGENDA_TOPICS}`,
)

// ── 2  Titles are the council's, character for character ─────────────────────

{
  const offenders = topics.filter((t) => {
    const item = byId.get(t.id)
    return !item || t.title !== item.titleRaw
  })
  check(
    2,
    '🔴 every title is its source titleRaw CHARACTER FOR CHARACTER — no paraphrase, no truncation, no title-casing',
    offenders.length === 0,
    offenders.map((t) => `${t.id}\n            got:  ${t.title}\n            want: ${byId.get(t.id)?.titleRaw}`).join('\n          '),
  )
}

// ── 3  Source labels are built from the agenda's own two fields ──────────────

{
  const offenders = topics.filter((t) => {
    if (t.sourceLabel === undefined) return false
    const item = byId.get(t.id)
    const allowed = [item?.legislationRef?.trim(), item?.stage?.trim()].filter(Boolean)
    // Every token of the label must be one of the two verbatim fields.
    return t.sourceLabel.split(' · ').some((part) => !allowed.includes(part))
  })
  check(
    3,
    'every sourceLabel is built ONLY from legislationRef and stage, verbatim — no invented reference',
    offenders.length === 0,
    offenders.map((t) => `${t.id}: ${t.sourceLabel}`).join(' | '),
  )
}

// ── 4  The summary announces itself ──────────────────────────────────────────

check(
  4,
  '🔴 every topic has summaryIsGenerated: true — summaryPlain is the pipeline’s reading, not the council’s words',
  topics.length > 0 && topics.every((t) => t.summaryIsGenerated === true),
  topics.filter((t) => t.summaryIsGenerated !== true).map((t) => t.id).join(', '),
)

// ── 5  Nothing is invented where the agenda is silent ────────────────────────

check(
  5,
  'no topic has whyItMatters — an agenda does not carry a reason it matters, and writing one would be inventing',
  topics.every((t) => t.whyItMatters === undefined),
  topics.filter((t) => t.whyItMatters !== undefined).map((t) => t.id).join(', '),
)

// ── 6  The composer will accept it ───────────────────────────────────────────

{
  const over = topics.filter((t) => t.suggestedTitle.length > 200)
  check(
    6,
    'every suggestedTitle is <= 200 characters (createPostSchema)',
    over.length === 0,
    over.map((t) => `${t.id}: ${t.suggestedTitle.length}`).join(', '),
  )
}

// ── 7  Links ─────────────────────────────────────────────────────────────────

{
  const bad = topics.filter((t) => t.sourceUrl !== undefined && !/^https?:\/\//.test(t.sourceUrl))
  const fromBloomington = topics.filter((t) => (t.sourceUrl ?? '').startsWith('https://bloomington.in.gov/'))
  check(
    7,
    'every sourceUrl is an https bloomington.in.gov URL or absent — isHttpUrl has something real to validate',
    bad.length === 0 && fromBloomington.length === topics.filter((t) => t.sourceUrl !== undefined).length,
    bad.map((t) => `${t.id}: ${t.sourceUrl}`).join(', '),
  )
}

// ── 8  The filter kept the meeting's machinery out ───────────────────────────

{
  const excluded = ['procedural', 'minutes', 'public-comment', 'appointment', 'report', 'proclamation', 'other']
  const leaked = topics.filter((t) => excluded.includes(byId.get(t.id)?.kind))
  const present = excluded.filter((k) => items.some((i) => i.kind === k))
  check(
    8,
    `no procedural, minutes or public-comment item survived the filter (the fixture has ${present.join(', ')})`,
    leaked.length === 0 && present.length > 0,
    leaked.map((t) => `${t.id}: ${byId.get(t.id)?.kind}`).join(', '),
  )
}

// ── 9  An ordinance with no summary is dropped, not written for ──────────────

{
  // Synthetic, because every ordinance and resolution on THIS agenda happens to
  // carry a summary. The rule still has to hold: an item with nothing to
  // discuss from gets nothing written for it.
  const blank = { ...qualifying[0], id: 'blank-1', summaryPlain: '' }
  const whitespace = { ...qualifying[0], id: 'blank-2', summaryPlain: '   ' }
  const missing = { ...qualifying[0], id: 'blank-3', summaryPlain: null }
  const got = agendaItemsToTopics([blank, whitespace, missing], meeting, 'city', GEOID)
  check(
    9,
    'an ordinance whose summaryPlain is empty, whitespace or null is DROPPED — nothing is written for it',
    got.length === 0,
    got.map((t) => t.id).join(', '),
  )
}

// ── 10  Degenerate inputs ────────────────────────────────────────────────────

{
  let threw = null
  let empty = null
  try {
    empty = agendaItemsToTopics([], meeting, 'city', GEOID)
  } catch (e) {
    threw = String(e)
  }
  check(
    10,
    'an empty agenda returns [] and does not throw',
    threw === null && Array.isArray(empty) && empty.length === 0,
    threw ?? JSON.stringify(empty),
  )
}

// ── 11  The body names itself ────────────────────────────────────────────────

{
  const name = bodyNameFrom(meeting)
  check(
    11,
    '🔴 bodyNameFrom reads the body off the record — Bloomington’s is the Common Council, not a City Council',
    name === 'Common Council',
    `got ${JSON.stringify(name)} from ${JSON.stringify(meeting.title)} / ${JSON.stringify(meeting.meetingType)}`,
  )
}
{
  const cases = [
    [{ title: null, meetingType: 'Board of Supervisors Meeting', date: '2026-01-01' }, 'Board of Supervisors Meeting'],
    [{ title: 'Metro Council Special Session — 2026-02-03', meetingType: 'Special Session', date: '2026-02-03' }, 'Metro Council'],
    [{ title: '   ', meetingType: null, date: '2026-02-03' }, null],
  ]
  const got = cases.map(([m]) => bodyNameFrom(m))
  check(
    12,
    'bodyNameFrom falls back to meetingType, then to null — naming no body is honest, naming the wrong one is not',
    got.every((v, i) => v === cases[i][1]),
    got.map((v) => JSON.stringify(v)).join(', '),
  )
}

// ── 13  The geoid stamp is the caller's, never the response's ────────────────

{
  const other = agendaItemsToTopics(items, meeting, 'county', '18105')
  check(
    13,
    'every topic carries the level and geoid it was CALLED with — the attachment key never comes from the response',
    topics.every((t) => t.level === 'city' && t.geoid === GEOID) &&
      other.every((t) => t.level === 'county' && t.geoid === '18105'),
    topics.map((t) => `${t.level}|${t.geoid}`).join(', '),
  )
}

// ── 14, 15  The other half of check 6: the branch that actually cuts ─────────

// 🔴 Check 6 passes and always has, on zero evidence. The longest
// legislationRef on this agenda is 31 characters, so the longest suggestedTitle
// it can produce is 56 — the cap has never been approached, let alone reached,
// and the cutting branch below it has never run in this guard's life. These two
// synthetic references drive it. Both are invented machinery for the test, not
// civic record: no council printed either.
const LONG_REF =
  'Ordinance 2026-77 concerning the appropriation of funds for the operation and maintenance of the ' +
  'municipal stormwater utility and the related drainage easements lying within the corporate boundaries ' +
  'of the city and the unincorporated remainder of the township'
const UNBROKEN_REF = `Ordinance-2026-77-${'x'.repeat(400)}`

{
  const derive = (id, legislationRef) =>
    agendaItemsToTopics([{ ...qualifying[0], id, legislationRef }], meeting, 'city', GEOID)[0]

  const wordy = derive('cap-wordy', LONG_REF).suggestedTitle
  const unbroken = derive('cap-unbroken', UNBROKEN_REF).suggestedTitle

  // The cut landed on a word boundary: what survives is a prefix of the source
  // that ends mid-nothing — the source's next character is not a word character.
  const head = wordy.slice(0, -1)
  const onBoundary =
    LONG_REF.startsWith(head) && head.length > 0 && /[^\p{L}\p{N}]/u.test(LONG_REF[head.length] ?? '')

  check(
    14,
    '🔴 a reference over the cap is elided on a word boundary and SAYS SO — not sliced mid-word',
    wordy.length <= 200 &&
      unbroken.length <= 200 &&
      wordy.endsWith('…') &&
      unbroken.endsWith('…') &&
      onBoundary &&
      wordy !== LONG_REF.slice(0, 200),
    `wordy [${wordy.length}] ${JSON.stringify(wordy)}\n` +
      `          unbroken [${unbroken.length}] ${JSON.stringify(unbroken.slice(0, 60))}…\n` +
      `          onBoundary=${onBoundary}, hard slice(0,200) would have ended ` +
      `${JSON.stringify(LONG_REF.slice(180, 200))}`,
  )

  check(
    15,
    'CONTROL: both synthetic references really do blow the cap, so 14 is not passing on a string that fits',
    LONG_REF.length > 200 &&
      UNBROKEN_REF.length > 200 &&
      `What should happen with ${LONG_REF}?`.length > 200 &&
      !UNBROKEN_REF.slice(0, 200).includes(' ') &&
      wordy.length < LONG_REF.length,
    `LONG_REF=${LONG_REF.length}, UNBROKEN_REF=${UNBROKEN_REF.length}, ` +
      `first space in UNBROKEN_REF at ${UNBROKEN_REF.indexOf(' ')}, wordy=${wordy.length}` +
      '\n          If a reference now fits, these inputs stopped testing anything — lengthen them.',
  )

  // 16 — `question` is the OTHER string that lands in the title field, and it is
  // the one that looks like body copy. QuestionPicker's label in the composer is
  // "Pick a question from Empowered.vote as your title", and picking one calls
  // setValue('title', …). Same reference, same cap, same elision.
  const q = derive('cap-question', LONG_REF).question
  check(
    16,
    '🔴 the topic QUESTION is capped and elided too — QuestionPicker offers it as the title',
    q.length <= POST_TITLE_MAX && q.endsWith('…') && q !== LONG_REF.slice(0, POST_TITLE_MAX),
    `question [${q.length}] ${JSON.stringify(q.slice(-50))}`,
  )
}

// ── 17, 18  What the composer actually offers, through the shipped assembler ──

{
  // 🔴 The reachable case, and it needs no invention: this is a REAL item off the
  // frozen agenda with its legislationRef and stage removed — the shape
  // sourceLabelFor() and referenceFor() both explicitly support, for an agenda
  // that printed neither. questionsFor() then builds its fallback questions around
  // the item's own titleRaw, which on this agenda runs to 240 characters.
  const longest = qualifying.slice().sort((a, b) => b.titleRaw.length - a.titleRaw.length)[0]
  const unlabelled = { ...longest, id: 'no-label', legislationRef: null, stage: null }
  const topic = agendaItemsToTopics([unlabelled], meeting, 'city', GEOID)[0]
  const offered = questionsFor(topic)
  const over = offered.filter((o) => o.length > POST_TITLE_MAX)
  const quoted = offered.find((o) => o.includes('“'))
  const naive = `What would you like to understand better about “${longest.titleRaw}”?`

  check(
    17,
    `every question the composer offers fits the title cap — ${offered.length} for an item with no printed reference`,
    over.length === 0 && offered.length > 1,
    over.map((o) => `[${o.length}] ${o.slice(0, 60)}…`).join('\n          ') ||
      `offered only ${offered.length}`,
  )

  check(
    18,
    'CONTROL: that item really would overflow, and the elided question still closes its quote and stays a question',
    naive.length > POST_TITLE_MAX &&
      longest.titleRaw.length > POST_TITLE_MAX &&
      topic.sourceLabel === undefined &&
      quoted !== undefined &&
      quoted.endsWith('”?') &&
      quoted.includes('…'),
    `titleRaw=${longest.titleRaw.length}, naive question=${naive.length}, ` +
      `sourceLabel=${JSON.stringify(topic.sourceLabel ?? null)}\n          quoted: ${JSON.stringify(quoted ?? null)}` +
      '\n          If titleRaw now fits, this fixture stopped exercising the fallback — pick a longer item.',
  )
}

// ── 19  The backstop, which the two checks above cannot reach ────────────────

{
  // 17 is satisfied by the SUBJECT cap alone, so it would pass with the final
  // pass in questionsFor() deleted. These two routes reach that pass and nothing
  // else does: a hand-written question over the cap, and `namePlaceIn` making a
  // question LONGER by putting a place name where "your city" was. Every
  // question in src/mocks/topicQuestions.ts is 92 characters or less today —
  // which is why this is synthetic rather than read from there.
  const OVERLONG = `What do you make of ${'the proposal '.repeat(20)}as written?`
  const STRETCHED = `What should your city do about ${'a '.repeat(80)}this?`
  const PLACE = 'Winchester-on-the-Severn-and-Little-Magothy-River'.repeat(3)

  const offered = questionsFor({
    id: 'synthetic-backstop',
    question: OVERLONG,
    title: 'T',
    level: 'city',
    moreQuestions: [STRETCHED],
    namedFor: PLACE,
  })
  const stretched = offered.find((o) => o.includes(PLACE.slice(0, 20)))
  const over = offered.filter((o) => o.length > POST_TITLE_MAX)

  check(
    19,
    'a question over the cap, and one that namePlaceIn LENGTHENS past it, are both elided — the backstop is live',
    OVERLONG.length > POST_TITLE_MAX &&
      STRETCHED.length < POST_TITLE_MAX &&
      stretched !== undefined &&
      over.length === 0 &&
      offered.every((o) => o.length < POST_TITLE_MAX || o.endsWith('…')),
    `input question=${OVERLONG.length}, input stretched=${STRETCHED.length} (must START under the cap), ` +
      `named=${stretched?.length ?? 'NOT FOUND'}\n          over the cap: ` +
      (over.map((o) => o.length).join(', ') || 'none') +
      '\n          A question is allowed to grow when the place is named; it is not allowed to arrive over the cap.',
  )
}

// ── Read these by eye ────────────────────────────────────────────────────────

console.log('\n── Every derived topic, in full. Check 2 by eye as well as by script. ──')
for (const t of topics) {
  const item = byId.get(t.id)
  console.log(`\n  id            ${t.id}`)
  console.log(`  category      ${t.category}`)
  console.log(`  title         ${t.title}`)
  console.log(`  (titleRaw)    ${item?.titleRaw}`)
  console.log(`  summary       ${t.summary}`)
  console.log(`  sourceLabel   ${t.sourceLabel ?? '(none)'}`)
  console.log(`  question      ${t.question}`)
  console.log(`  suggested     ${t.suggestedTitle} [${t.suggestedTitle.length}]`)
  console.log(`  sourceUrl     ${t.sourceUrl ?? '(none)'}`)
  console.log(`  sourceDate    ${t.sourceDate}`)
  console.log(`  generated     ${t.summaryIsGenerated}`)
  console.log(`  whyItMatters  ${t.whyItMatters ?? '(absent — correct)'}`)
}

console.log(`\n${passed} PASS, ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
