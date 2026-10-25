/**
 * Every decision Phase 16 makes about WHICH content a slice gets, as pure
 * functions over plain data.
 *
 * 🔴 This module has no runtime imports, deliberately. Every import below is
 * `import type`, which is erased, so `node --experimental-strip-types` can load
 * this file and run the SHIPPED functions rather than a transcription of them.
 * `scripts/check-composition.mjs` does exactly that. A copy-test passes while
 * the shipped code is wrong, so do not add a value import here without moving
 * the check to something that can still reach the real thing.
 *
 * Nothing here touches React, React Query, Supabase, `localStorage` or the
 * network. Resolution inputs arrive as arguments; the caller
 * (`src/lib/exploreData.ts`) owns the plumbing.
 */

import type { ElectionArea } from '../hooks/useNextElection'
import type {
  ExploreComposition,
  ExploreLevel,
  ExploreTopic,
  ModuleId,
  TopicId,
} from '../types/explore'

// ── Keys ────────────────────────────────────────────────────────────────────

/**
 * Slice types with no place of their own.
 *
 * 🔴 These key on the slice type ALONE. The dev fixture gives federal the geoid
 * '3711' (a pre-taxonomy congressional district) and unified the empty string,
 * where production uses 'US' and 'UNIFIED'. Including the geoid would resolve a
 * different composition on localhost than in production — the exact class of bug
 * that only shows up after deploy.
 */
const PLACELESS = new Set(['federal', 'unified', 'volunteer'])

export function compositionKey(sliceType: string, geoid: string | null): string {
  return PLACELESS.has(sliceType) ? sliceType : `${sliceType}|${geoid ?? ''}`
}

/**
 * Where an Explore draft lives. A draft names its jurisdiction so it cannot be
 * posted into a different one — the phase's loudest anti-goal.
 */
export function draftKey(sliceType: string, geoid: string | null, topicId: TopicId): string {
  return `${compositionKey(sliceType, geoid)}|${topicId}`
}

export interface ParsedDraftKey {
  sliceType: string
  /** null for a placeless type, AND for a draft written signed out. */
  geoid: string | null
  topicId: TopicId
}

/**
 * The reverse. Lives beside draftKey so the two formats cannot drift.
 *
 * 🔴 Returns null rather than throwing. A corrupt `localStorage` value is a thing
 * that happens, and a throw here would take down ExploreView's whole render.
 *
 * Three shapes, and the third is the one that bites:
 *   federal|<topicId>          two segments, a placeless type
 *   city|<geoid>|<topicId>     three segments, a real place
 *   city||<topicId>            three segments with an EMPTY middle — a draft
 *                              typed while signed out. It must parse to
 *                              geoid: null, not '', or canPostDraft compares ''
 *                              against a real geoid and refuses a draft it
 *                              should accept.
 *
 * A topic id containing '|' is tolerated: everything past the jurisdiction is
 * rejoined rather than truncated.
 */
export function parseDraftKey(key: string): ParsedDraftKey | null {
  if (typeof key !== 'string' || key.length === 0) return null
  const parts = key.split('|')
  const sliceType = parts[0]
  if (!sliceType) return null

  if (PLACELESS.has(sliceType)) {
    const topicId = parts.slice(1).join('|')
    if (!topicId) return null
    return { sliceType, geoid: null, topicId }
  }

  // A place key always carries its geoid segment, even when that segment is empty.
  if (parts.length < 3) return null
  const rawGeoid = parts[1] ?? ''
  const topicId = parts.slice(2).join('|')
  if (!topicId) return null
  return { sliceType, geoid: rawGeoid === '' ? null : rawGeoid, topicId }
}

/** What a draft needs to know about the member's slices to decide where it may land. */
export interface DraftTargetSlice {
  id: string
  geoid: string
}

export type CanPostDraftResult =
  | { ok: true; sliceType: string; sliceId: string }
  | { ok: false; reason: 'unparseable' | 'no-slice' | 'moved' }

/**
 * May this draft be posted, and where?
 *
 * The anti-goal is a post landing in the wrong jurisdiction — a NATO question in
 * a city feed. A draft names its jurisdiction in its key, and the member must
 * still hold a slice of that type, with that geoid, right now.
 *
 * geoid === null has two sources and both are safe to accept:
 *   - a placeless type (federal, unified), which has no geoid to disagree about
 *   - a draft typed while signed OUT, which 16-04 re-keys to the member's own
 *     slice on sign-in. Until then it binds to whatever they hold for that type,
 *     which is today's behaviour and what 16-CONTEXT settled.
 *
 * Returning a reason rather than a boolean matters: `no-slice` and `moved` are
 * different things to a member, and 16-04 decides what each one says.
 */
export function canPostDraft(
  key: string,
  slices: Partial<Record<string, DraftTargetSlice | undefined>>,
): CanPostDraftResult {
  const parsed = parseDraftKey(key)
  if (!parsed) return { ok: false, reason: 'unparseable' }
  const slice = slices[parsed.sliceType]
  if (!slice) return { ok: false, reason: 'no-slice' }
  if (parsed.geoid !== null && parsed.geoid !== slice.geoid) return { ok: false, reason: 'moved' }
  return { ok: true, sliceType: parsed.sliceType, sliceId: slice.id }
}

/**
 * Re-keys drafts written while signed out onto the slices the member actually
 * holds, once, after sign-in.
 *
 * 🔴 The gap this closes: a visitor types a draft signed out, so it is stored at
 * `city||<topicId>`. They then sign in FROM THE HEADER rather than by pressing
 * Join, so no resume marker exists. Every reader from then on looks for
 * `city|<geoid>|<topicId>` — a different key — and the draft they typed is
 * invisible forever. The resume path only covers the member who pressed Join.
 * 16-CONTEXT "Settled after research" item 3 is explicit that a signed-out draft
 * binds to the member's own slice ON SIGN-IN, not only on resume.
 *
 * Rules:
 *  - A key with a non-null geoid is left alone. It is already bound.
 *  - A placeless key (`federal|topic`) is left alone. It has no geoid segment,
 *    so its null geoid means "no place", not "not bound yet".
 *  - A null-geoid key whose type the member has NO slice for is left alone,
 *    not deleted: they may be assigned that slice later, and a draft is cheap.
 *  - If the destination key already exists, the NEWER updatedAt wins, and the
 *    other is dropped. Two drafts for one topic in one place is not a state the
 *    UI can show.
 *  - An unparseable key is left alone, for the same reason parseDraftKey returns
 *    null rather than throwing: corrupt localStorage must not cost a render.
 *
 * `changed` is returned so the caller can skip the write when there is nothing
 * to do — this runs on every authenticated mount and must be free in the common
 * case.
 */
export function migrateSignedOutDrafts<T extends { updatedAt: number }>(
  drafts: Readonly<Record<string, T>>,
  slices: Partial<Record<string, GeoidBearingSlice | undefined>>,
): { next: Record<string, T>; changed: boolean } {
  const next: Record<string, T> = { ...drafts }
  let changed = false
  for (const [key, draft] of Object.entries(drafts)) {
    const parsed = parseDraftKey(key)
    if (!parsed || parsed.geoid !== null) continue
    if (PLACELESS.has(parsed.sliceType)) continue
    const geoid = slices[parsed.sliceType]?.geoid
    if (!geoid) continue
    const bound = draftKey(parsed.sliceType, geoid, parsed.topicId)
    if (bound === key) continue
    const existing = next[bound]
    if (!existing || draft.updatedAt > existing.updatedAt) next[bound] = draft
    delete next[key]
    changed = true
  }
  return { next, changed }
}

// ── Levels, and what each is made of ────────────────────────────────────────

const LEVEL_BY_SLICE_TYPE: Readonly<Record<string, ExploreLevel>> = {
  city: 'city',
  county: 'county',
  state: 'state',
  federal: 'federal',
  unified: 'unified',
}

/** The level a slice type explores at, or null. Volunteer has no Explore and never has. */
export function levelFor(sliceType: string): ExploreLevel | null {
  return LEVEL_BY_SLICE_TYPE[sliceType] ?? null
}

/**
 * The table that makes "each slice feels like itself" true. A composition names
 * the modules it has and their order; everything else is simply absent, which is
 * what makes Federal differ from City structurally and not only in its text.
 *
 * City and County lead with the place and something to go do, and `imagine` is
 * theirs alone — a crosswalk game on the Federal tab is exactly the mismatch
 * this phase removes. State drops `imagine`, `nearby` and `agenda`: no
 * state-agenda source exists anywhere in the stack. Federal leads with a vote
 * broken down, which is a RESERVED room because the tally exists and the
 * plain-language summary does not exist anywhere. Unified is its own thing:
 * world questions, no races, no calendar, no place.
 *
 * 🔴 Federal keeps `featured`. An earlier draft of this table omitted it, which
 * silently dropped the top-ranked topic from the page entirely — see
 * selectForModules, which assigns against this list rather than by position.
 *
 * 🔴 Frozen on purpose. resolveComposition copies before it returns, and 16-08
 * reorders per composition; a mutation here would leak into every other slice.
 */
export const DEFAULT_MODULES: Readonly<Record<ExploreLevel, readonly ModuleId[]>> = {
  city: [
    'intro',
    'featured',
    'imagine',
    'agenda',
    'questions',
    'nearby',
    'coming-up',
    'ballot-measures',
    'seed-invitation',
    'symposiums',
    'civic-listening',
    'common-grounds',
    'focused-communities',
    'slice-action-votes',
    'whats-new',
  ],
  county: [
    'intro',
    'featured',
    'imagine',
    'agenda',
    'questions',
    'nearby',
    'coming-up',
    'ballot-measures',
    'seed-invitation',
    'symposiums',
    'civic-listening',
    'common-grounds',
    'focused-communities',
    'slice-action-votes',
    'whats-new',
  ],
  state: [
    'intro',
    'featured',
    'races',
    'debates',
    'questions',
    'coming-up',
    'legislator-votes',
    'ballot-measures',
    'seed-invitation',
    'symposiums',
    'civic-listening',
    'common-grounds',
    'slice-action-votes',
    'whats-new',
  ],
  federal: [
    'intro',
    'featured',
    'federal-votes',
    'races',
    'debates',
    'questions',
    'debate-schedule',
    'symposiums',
    'civic-listening',
    'common-grounds',
    'slice-action-votes',
    'whats-new',
  ],
  unified: ['intro', 'featured', 'questions', 'common-grounds', 'civic-listening', 'symposiums', 'whats-new'],
}

// ── Selection ───────────────────────────────────────────────────────────────

/**
 * Modules that OWN a provenance: every topic carrying it belongs to that module
 * and to no other. The agenda section renders the whole derived set with its own
 * header and source link, so an agenda item must not also show up as the
 * featured card and as a question card on the same page.
 */
const MODULE_OWNED_PROVENANCE: Partial<Record<ModuleId, readonly ExploreTopic['provenance'][]>> = {
  agenda: ['derived-from-agenda'],
}

/**
 * Assigns topics to the modules that will render them, so nothing is shown twice
 * and nothing with a module to live in is dropped.
 *
 * Order of claim:
 *   1. A module that OWNS a provenance claims those topics.
 *   2. 'featured' takes the first remaining topic — but only if the composition
 *      HAS a featured module. On a composition without one, the first topic
 *      stays in the pool and becomes a question; after Compass ranking it is the
 *      single most relevant topic to that member and dropping it is the worst
 *      available outcome.
 *   3. 'questions' takes the next few remaining.
 *
 * The rule, stated once: a topic appears in exactly one module.
 *
 * `questionCount` is a parameter with a default so the committed check can probe
 * the boundaries without depending on the number.
 */
function ownedProvenancesOf(modules: readonly ModuleId[]): Set<ExploreTopic['provenance']> {
  const owned = new Set<ExploreTopic['provenance']>()
  for (const moduleId of modules) {
    for (const provenance of MODULE_OWNED_PROVENANCE[moduleId] ?? []) owned.add(provenance)
  }
  return owned
}

export function selectForModules(
  topics: readonly ExploreTopic[],
  modules: readonly ModuleId[],
  questionCount = 4,
): { featuredTopicId: TopicId | null; questionTopicIds: TopicId[] } {
  const ownedProvenances = ownedProvenancesOf(modules)
  const unclaimed = topics.filter((topic) => !ownedProvenances.has(topic.provenance))

  const hasFeatured = modules.includes('featured')
  const featuredTopicId = hasFeatured ? (unclaimed[0]?.id ?? null) : null

  const remaining = featuredTopicId === null ? unclaimed : unclaimed.slice(1)
  const questionTopicIds = modules.includes('questions')
    ? remaining.slice(0, Math.max(0, questionCount)).map((topic) => topic.id)
    : []

  return { featuredTopicId, questionTopicIds }
}

/** Which topics a module claims outright, so a caller can prove the sets are disjoint. */
export function topicsClaimedByModules(
  topics: readonly ExploreTopic[],
  modules: readonly ModuleId[],
): TopicId[] {
  const ownedProvenances = ownedProvenancesOf(modules)
  return topics.filter((topic) => ownedProvenances.has(topic.provenance)).map((topic) => topic.id)
}

// ── The Compass level filter, and the ranking ───────────────────────────────

/** The three flags `GET /api/compass/topics` sends that describe a level of government. */
export interface CompassLevelFlags {
  federal: boolean
  state: boolean
  local: boolean
}

/**
 * Unified is deliberately absent: the catalog has no "world" flag, so there is
 * nothing to exclude against and a missing entry must never silently drop a
 * topic.
 */
const COMPASS_FLAG_FOR_LEVEL: Partial<Record<ExploreLevel, keyof CompassLevelFlags>> = {
  federal: 'federal',
  state: 'state',
  city: 'local',
  county: 'local',
}

export type LevelFilterReason = 'level-mismatch' | 'compass-level-flag'

/**
 * Why a topic is not shown at this level, or null when it is.
 *
 * Exported so a check can assert the REASON and not only the result: a function
 * that ignored the flags entirely would still exclude a city-level topic from
 * Federal, by `topic.level`, and would pass a result-only assertion.
 *
 * 🔴 Exclusion only. 45 of 60 Compass topics are flagged for all three levels,
 * so the flags cannot pick out "what federal leaders attend to"; what they can
 * do is keep the six local-only topics off Federal. A topic with no
 * `compassTopicId`, an id the catalog does not know, or no catalog at all passes
 * through — refusing to show a topic because a side lookup failed is worse than
 * showing it.
 */
export function levelFilterReason(
  topic: ExploreTopic,
  level: ExploreLevel,
  compassLevelFlags?: ReadonlyMap<string, CompassLevelFlags>,
): LevelFilterReason | null {
  if (topic.level !== level) return 'level-mismatch'
  if (!compassLevelFlags || !topic.compassTopicId) return null
  const flagKey = COMPASS_FLAG_FOR_LEVEL[level]
  if (!flagKey) return null
  const flags = compassLevelFlags.get(topic.compassTopicId)
  if (!flags) return null
  return flags[flagKey] ? null : 'compass-level-flag'
}

export function topicsForLevel(
  topics: readonly ExploreTopic[],
  level: ExploreLevel,
  compassLevelFlags?: ReadonlyMap<string, CompassLevelFlags>,
): ExploreTopic[] {
  return topics.filter((topic) => levelFilterReason(topic, level, compassLevelFlags) === null)
}

/**
 * Below this, the ordering says nothing and source order is kept instead of
 * pretending to a signal. MIN_SPOKES in useCompassData.ts:14 is the precedent
 * for refusing to draw a conclusion from too little.
 */
export const MIN_RANKED = 3

/**
 * Orders topics by whether the VIEWING MEMBER has answered the matching Compass
 * topic. Locked decision 7: Compass ranks topics, it does not produce them, and
 * no slice-wide aggregate of members' political answers is computed anywhere.
 *
 * Three properties, all checked in scripts/check-composition.mjs:
 *   - Stable. Ties keep source order, so a reload never reshuffles the page.
 *   - A permutation. It reorders; it never adds or removes. If a topic can
 *     vanish when Compass loads, the level filter has leaked into this path.
 *   - Inert below MIN_RANKED. Returns the input unchanged, same order.
 */
export function rankByCompass(
  topics: readonly ExploreTopic[],
  answeredTopicIds?: ReadonlySet<string>,
): ExploreTopic[] {
  const ordered = [...topics]
  if (!answeredTopicIds || answeredTopicIds.size < MIN_RANKED) return ordered
  return ordered
    .map((topic, index) => ({
      topic,
      index,
      score: topic.compassTopicId && answeredTopicIds.has(topic.compassTopicId) ? 1 : 0,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.topic)
}

// ── Resolution ──────────────────────────────────────────────────────────────

export interface ResolveCompositionInput {
  sliceType: string
  geoid: string | null
  /** The by-level generic pool. Filtered by level here, so passing all of it is safe. */
  generic?: readonly ExploreTopic[]
  /** Topics derived from a real source for this exact place. 16-06 supplies Bloomington's. */
  bespoke?: readonly ExploreTopic[]
  answeredCompassTopicIds?: ReadonlySet<string>
  compassLevelFlags?: ReadonlyMap<string, CompassLevelFlags>
}

/**
 * The design's resolution order: bespoke topics for this exact key; else the
 * generic topics for this level, level-filtered and Compass-ranked; and the seed
 * slot, loud when bespoke is empty.
 *
 * No geoid — a signed-out visitor, or a member with no slice for this tab —
 * means generic only, with no bespoke layer and no seed invitation: neither can
 * seed a place the app cannot name.
 *
 * Returns null for a slice type with no Explore (volunteer).
 */
export function resolveComposition(input: ResolveCompositionInput): ExploreComposition | null {
  const level = levelFor(input.sliceType)
  if (!level) return null

  const bespoke = input.bespoke ?? []
  const ranked = rankByCompass(
    topicsForLevel(input.generic ?? [], level, input.compassLevelFlags),
    input.answeredCompassTopicIds,
  )

  const topics = bespoke.length > 0 ? [...bespoke, ...ranked] : ranked
  // Copy: DEFAULT_MODULES is a module-level constant shared by every resolution.
  const modules = [...DEFAULT_MODULES[level]]
  const geoid = PLACELESS.has(input.sliceType) ? null : input.geoid

  return {
    key: compositionKey(input.sliceType, input.geoid),
    level,
    geoid,
    modules,
    topics,
    isUnseeded: !!geoid && bespoke.length === 0,
    ...selectForModules(topics, modules),
  }
}

// ── Areas ───────────────────────────────────────────────────────────────────

/** TIGER MTFCC for the two place-scale slice types races are asked about. */
const RACE_MTFCC = { city: 'G4110', county: 'G4020' } as const

/** Just the geoid, so callers can pass `SliceInfo` or anything shaped like it. */
export interface GeoidBearingSlice {
  geoid?: string | null
}

/**
 * The area to ask for RACES — the member's most local place. City, else county,
 * else NOTHING.
 *
 * 🔴 There is deliberately no state fallback. A state-area query is wrong in both
 * directions at once, verified live 2026-10-24:
 *   - Indiana's state area returns all 9 US House districts; the member has one.
 *     Bloomington's city area returns District 9 alone.
 *   - A state area OMITS statewide races: North Carolina's has no US Senate race,
 *     California's has no Governor. Their city areas have both.
 *   - Federal geoid 'US' returns HTTP 500; 'UNIFIED' is not a place.
 *   - California's state area is 456 KB / 493 races against 17-50 KB for a city.
 * Falling back to the state would reintroduce the nine-House-races bug this
 * function exists to prevent. A member with no city or county slice gets no races
 * module, which is the honest answer — nine races a member cannot choose between
 * is worse than none.
 *
 * NOT electionAreaFor() from useNextElection.ts, which DOES fall back to the
 * state. That is correct for "when is the next election" (every area answered
 * 2026-11-03) and wrong for "which races are mine". Keep both; never merge them.
 */
export function racesAreaFor(
  slices: Partial<Record<string, GeoidBearingSlice | undefined>>,
): ElectionArea | null {
  for (const type of ['city', 'county'] as const) {
    const geoid = slices[type]?.geoid
    if (geoid) return { geoid, mtfcc: RACE_MTFCC[type] }
  }
  return null
}

// ── Hrefs ───────────────────────────────────────────────────────────────────

/**
 * Any href taken from an API response passes through here first.
 *
 * React does not block a `javascript:` URL in an href, and agenda `sourceUrl`,
 * bill `url` and meeting `sourceUrl` are first-party but SCRAPED from city and
 * legislature sites. Accept `https:` and `http:` only; anything unparseable —
 * including a protocol-relative `//host/path`, which has no base here — is false.
 */
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
