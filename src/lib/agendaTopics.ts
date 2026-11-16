/**
 * Published agenda items → Explore topics, without writing a word of civic
 * content.
 *
 * 🔴 The whole point of this file is what it does NOT do. The anti-goal is
 * invented civic record, and an agenda is the easiest place in the app to
 * invent one by accident: paraphrasing a title into something punchier,
 * inferring a reason an ordinance matters, or presenting the pipeline's
 * plain-language summary as the council's own words. None of those happen here.
 *
 *   - `title` is `titleRaw`, character for character. Agenda titles run 60-150
 *     characters and read like legal text; that is what the council wrote, and
 *     truncation is a job for CSS, never for the data. A truncated civic title
 *     stored as data is a quote nobody said.
 *   - `sourceLabel` is built ONLY from `legislationRef` and `stage`, both
 *     verbatim ("extracted from the agenda, never invented" /
 *     "adapter-encoded body rules, never LLM-inferred", per the ev-accounts
 *     migration).
 *   - `summary` is `summaryPlain`, which the migration header calls a
 *     "plain-language interpretation" — written by the pipeline, not quoted
 *     from the agenda. Every topic therefore carries
 *     `summaryIsGenerated: true`, and SourceNote says so on the card.
 *   - `whyItMatters` is OMITTED. An agenda does not carry one, and writing one
 *     would be the anti-goal exactly.
 *   - `question` and `suggestedTitle` are templated from `legislationRef`.
 *     Template text asserts nothing about the world; it asks about a reference
 *     the agenda already printed.
 *   - `status` and `outcome` are never read. They are not even on AgendaItem.
 *
 * 🔴 `node --experimental-strip-types` has to be able to load this file and run
 * the SHIPPED function, because scripts/check-agenda-topics.mjs does exactly
 * that. Every type import below is therefore `import type`, erased before Node
 * sees it, and the ONE runtime import names `./postTitle.ts` with its
 * extension — Node resolves a relative TS specifier only when it is spelled in
 * full, and only to a file as plain as that one. An extensionless import, or
 * one reaching anything with a dependency of its own, takes the guard down
 * with ERR_MODULE_NOT_FOUND. It fails loudly and immediately, which is the
 * only reason this is a workable rule rather than a trap.
 *
 * 🔴 Stepping stone, not the destination. When
 * `GET /api/civic-spaces/explore?sliceType=&geoid=` lands (16-09's handoff Ask
 * 1), the route returns the composition with its bespoke topics already in it,
 * and this file plus useAgendaItems.ts are deleted.
 */

import { elide, POST_TITLE_MAX } from './postTitle.ts'
import type { AgendaItem, AgendaSource } from '../hooks/useAgendaItems'
import type { ExploreLevel, ExploreTopic } from '../types/explore'

/**
 * The only kinds that are a thing to discuss. The rest of the closed vocabulary
 * — appointment, report, procedural, minutes, public-comment, proclamation,
 * other — is the machinery of a meeting, not its subject matter.
 */
const DISCUSSABLE_KINDS: ReadonlySet<string> = new Set(['ordinance', 'resolution'])

/**
 * One budget meeting can carry a dozen appropriation ordinances. Past this the
 * section stops being a way in and becomes a wall, which is goal 6's failure
 * mode. Agenda order (`position`) decides who makes the cut, because the
 * council's own ordering is the only ordering we are entitled to.
 */
export const MAX_AGENDA_TOPICS = 8

/**
 * 🔴 BOTH strings below are destined for the title field, so both answer to
 * createPostSchema's cap. `suggestedTitle` goes there when a member picks this
 * topic in the composer; `question` goes there when they pick it from
 * QuestionPicker, whose label is "Pick a question from Empowered.vote as your
 * title". The second route is easy to miss — it reads like body copy and it is
 * not.
 */
const MAX_SUGGESTED_TITLE = POST_TITLE_MAX

/**
 * Our words about the shape of the thing, never about the thing. "On the
 * council agenda" states no fact that is not on the agenda's front page.
 */
function categoryFor(kind: string): string {
  return kind === 'resolution' ? 'Resolution on the agenda' : 'Ordinance on the agenda'
}

/**
 * What to call this item in a sentence. The legislation reference when the
 * agenda printed one, else the generic noun — never a name we made up for it.
 */
function referenceFor(item: AgendaItem): string {
  const ref = item.legislationRef?.trim()
  if (ref) return ref
  return item.kind === 'resolution' ? 'this resolution' : 'this ordinance'
}

/**
 * Verbatim, joined. `undefined` when the agenda printed neither — an empty
 * label is better than a label we invented, and ProvenanceTag falls back to
 * "From a published agenda", which is true without being specific.
 */
function sourceLabelFor(item: AgendaItem): string | undefined {
  const parts = [item.legislationRef?.trim(), item.stage?.trim()].filter(
    (part): part is string => !!part,
  )
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * A sentence built around the reference, cut to the title cap if it has to be.
 *
 * 🔴 The TEMPLATE is what gets dropped, never the reference. "What should
 * happen with Ordinance 2026-2…" names nothing; a reference that survives and
 * a sentence that does not is the right way round. Only when the bare
 * reference ALSO exceeds the cap is the reference itself elided — a title
 * longer than the schema allows is a post that cannot be created, and an
 * elided one at least admits to being short.
 */
function sentenceAbout(template: (reference: string) => string, reference: string): string {
  const full = template(reference)
  if (full.length <= MAX_SUGGESTED_TITLE) return full
  return elide(reference, MAX_SUGGESTED_TITLE)
}

/**
 * Agenda items → topics for one slice.
 *
 * 🔴 `geoid` is the SLICE's — the one the composition was resolved for — and
 * never anything taken from the response. The meetings API is keyed on a city
 * name plus a state abbreviation, so the REQUEST has to be made by name; the
 * ATTACHMENT must not be, because a name is not a key and two cities of one
 * name in one state would collide. resolveComposition re-checks this stamp
 * against its own geoid and discards anything that disagrees, so a collision
 * yields no topics rather than the wrong city's topics.
 */
export function agendaItemsToTopics(
  items: readonly AgendaItem[],
  meeting: AgendaSource,
  level: ExploreLevel,
  geoid: string,
): ExploreTopic[] {
  return items
    .filter((item) => DISCUSSABLE_KINDS.has(item.kind) && !!item.summaryPlain?.trim())
    // Agenda order. Never by status or outcome — see the note at the top of
    // useAgendaItems.ts for why those two fields do not exist down here.
    .slice()
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_AGENDA_TOPICS)
    .map((item): ExploreTopic => {
      const reference = referenceFor(item)
      const sourceLabel = sourceLabelFor(item)
      const topic: ExploreTopic = {
        id: `agenda-${item.id}`,
        category: categoryFor(item.kind),
        // 🔴 Verbatim. Not trimmed, not title-cased, not shortened.
        title: item.titleRaw,
        // 🔴 Machine-written. summaryIsGenerated below is what makes that honest.
        summary: item.summaryPlain ?? '',
        // 🔴 Both of these end up in the title field — see MAX_SUGGESTED_TITLE.
        question: sentenceAbout((r) => `What would you want to know about ${r}?`, reference),
        suggestedTitle: sentenceAbout((r) => `What should happen with ${r}?`, reference),
        level,
        geoid,
        provenance: 'derived-from-agenda',
        sourceDate: meeting.date,
        summaryIsGenerated: true,
      }
      // Optional properties are assigned rather than set to undefined:
      // exactOptionalPropertyTypes aside, an absent label and a label of
      // `undefined` should not be two different records.
      if (sourceLabel) topic.sourceLabel = sourceLabel
      // 🔴 The URL is NOT validated here. isHttpUrl lives in exploreComposition
      // and importing it would give this module a runtime import, which is what
      // keeps the committed check able to run the shipped code. SourceNote
      // validates every href it renders; this layer only carries the string.
      if (item.sourceUrl) topic.sourceUrl = item.sourceUrl
      return topic
    })
}

/**
 * The body's own name, from its own record.
 *
 * 🔴 Never "City Council". Bloomington's body is the **Common Council**, and
 * every one of its four scheduled meetings is titled
 * `Common Council Regular Session — YYYY-MM-DD`. "Bloomington City Council" is
 * a plausible-sounding name for a body that does not exist under that name,
 * which is invented civic record in its mildest and most likely form — and the
 * next covered place will be a Board of Supervisors, a Metro Council or a City
 * Commission, none of which are a City Council either.
 *
 * So: take the meeting title, strip the trailing date and the meetingType it
 * repeats, and use what is left. Fall back to meetingType, then to null —
 * naming no body is honest, naming the wrong one is not, and the module writes
 * "From the agenda of {date}" when this returns null.
 */
export function bodyNameFrom(meeting: AgendaSource): string | null {
  const title = meeting.title?.trim()
  if (title) {
    let name = title
    // 'Common Council Regular Session — 2026-10-14' → drop everything from the
    // separator before a trailing ISO date, or the date alone if it is bare.
    name = name.replace(/\s*[—–-]?\s*\d{4}-\d{2}-\d{2}\s*$/, '').trim()
    const type = meeting.meetingType?.trim()
    if (type && name.toLowerCase().endsWith(type.toLowerCase())) {
      name = name.slice(0, name.length - type.length).trim()
    }
    // A trailing separator left behind by either strip.
    name = name.replace(/[—–\-:,]\s*$/, '').trim()
    if (name) return name
  }
  return meeting.meetingType?.trim() || null
}
