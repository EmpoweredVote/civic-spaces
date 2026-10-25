/**
 * Explore's record shapes. Neutral by design: this module imports nothing from
 * components/ or lib/, so src/mocks/civicSpacesExplore.ts and
 * src/components/explore/* can both depend on it without the import cycle that
 * existed while these lived in components/explore/exploreContent.ts.
 *
 * 🔴 ILLUSTRATIVE, NOT CIVIC RECORD applies to every record typed here. A topic
 * whose text was not drawn from a real source must carry provenance 'staff' and
 * must never claim otherwise. See the banner at the top of exploreContent.ts.
 */

/** The levels that have an Explore. Volunteer has none and is deliberately absent. */
export type ExploreLevel = 'federal' | 'state' | 'county' | 'city' | 'unified'

/**
 * Who put this topic here. Provenance is part of the record from day one because
 * the design admits three sources at once (staff, a local chapter, a government
 * body's own agenda) and the UI has to be able to say honestly which is which.
 */
export type TopicProvenance =
  | 'staff'                 // written at Empowered Vote. A conversation starter.
  | 'chapter'               // a nonpartisan local chapter (LWV, Braver Angels).
  | 'derived-from-agenda'   // built from a published agenda item. Verbatim title.
  | 'derived-from-vote'     // built from a published roll call.
  | 'member'                // requested by a member of this place.

/**
 * Was a closed union of eight literals. Now a string, because a bespoke,
 * agenda-derived or member-requested topic cannot be a member of a union that
 * ships with the app. Every lookup is therefore partial — see the note on
 * noUncheckedIndexedAccess in 16-SHARED.md.
 */
export type TopicId = string

export interface ExploreTopic {
  id: TopicId
  category: string
  title: string
  summary: string
  /**
   * Optional since 16-01. An agenda item carries a title, a plain-language
   * summary and a stage; it does not carry a reason it matters, and writing one
   * for it would be inventing civic record.
   */
  whyItMatters?: string
  question: string
  /** Pre-filled, editable post title. Must fit createPostSchema (<=200). */
  suggestedTitle: string
  blurb?: string
  usesMeetingSources?: boolean

  // ── The slice dimension, new in Phase 16 ──────────────────────────────────

  /** Which level this topic belongs to. A local-scale topic must never show on Federal. */
  level: ExploreLevel
  /** The jurisdiction it is bespoke to; null means "applies anywhere at this level". */
  geoid: string | null
  provenance: TopicProvenance

  // ── Provenance detail, so the UI can show its working ─────────────────────

  /** e.g. "Ordinance 2026-22 · Second reading - final vote". Verbatim from the source. */
  sourceLabel?: string
  /** The published document this was derived from. Must pass isHttpUrl before rendering. */
  sourceUrl?: string
  sourceDate?: string
  /**
   * True when `summary` is a machine-written interpretation rather than the
   * source's own words. The UI must say so.
   */
  summaryIsGenerated?: boolean
  /**
   * The Compass topic this question is nearest to, used for level exclusion and
   * for ranking against the VIEWING MEMBER's own answers.
   *
   * 🔴 Must be a real id from GET /api/compass/topics. Never invent one: an
   * invented id matches nothing, so the ranking and the level filter both
   * silently become no-ops and nothing fails to tell you.
   */
  compassTopicId?: string
}

/**
 * The rooms a composition can contain. A slice's composition names the modules it
 * has and their order; everything else is simply absent, which is what makes
 * Federal differ from City structurally and not only in its text.
 */
export type ModuleId =
  // Built, or buildable from a real source this phase
  | 'intro'
  | 'featured'
  | 'questions'
  | 'imagine'
  | 'nearby'
  | 'coming-up'
  | 'agenda'
  | 'races'
  | 'debates'
  | 'whats-new'
  /**
   * The welcome for a place nobody has seeded yet. Built in 16-08, WITHOUT the
   * vote behind it (Chris, 2026-10-24: "show it without the vote for now").
   */
  | 'seed-invitation'
  // Reserved: a real source exists but is out of this phase's scope
  | 'legislator-votes'
  // Reserved: no source anywhere in the stack (see 16-09 and the handoff)
  | 'ballot-measures'
  | 'federal-votes'
  | 'debate-schedule'
  // Reserved: the coming Connect features. Slots only — nothing is built.
  | 'symposiums'
  | 'civic-listening'
  | 'common-grounds'
  | 'focused-communities'
  | 'slice-action-votes'

export interface ExploreComposition {
  /** Normalised `(sliceType, geoid)` key — see compositionKey(). */
  key: string
  level: ExploreLevel
  /** null for federal/unified and for a viewer with no jurisdiction. */
  geoid: string | null
  /** Ordered. The whole point of the registry. */
  modules: ModuleId[]
  topics: ExploreTopic[]
  /**
   * null when this composition has no `featured` module. See selectForModules()
   * for why these are chosen against the module list rather than by position.
   */
  featuredTopicId: TopicId | null
  questionTopicIds: TopicId[]
  /** True when no bespoke topic exists for this exact key. Drives the seed invitation. */
  isUnseeded: boolean
}
