import type { PoliticianFlatRecord } from '../types/representatives'
import type { ExploreLevel, ExploreTopic } from '../types/explore'

/**
 * Conversation starters built from the public list of who holds office here.
 *
 * 🔴 The only local fact used is the RECORD: a name and an office title, verbatim
 * from the by-area officials lookup that already fills "Representing this
 * community". Nothing is said about what anyone has done, voted for or proposed —
 * there is no source for that here, and inventing it is the anti-goal. Every
 * question asks for the WRITER's view ("what would you ask…"), never states one.
 *
 * Covers every place the officials lookup covers, which is the point: it is the
 * one local source available nationally today. Agendas reach one city; this
 * reaches any address with a district.
 *
 * Pure, and with type-only imports, so a Node check can load it directly.
 */

/** Which offices belong together on one card, per level. Order is the order shown. */
interface OfficeGroup {
  key: string
  districtTypes: readonly string[]
  /** Narrows a district type that mixes offices — STATE_EXEC holds more than the governor. */
  pick?: (rep: PoliticianFlatRecord) => boolean
  /** How a card names the group when it holds more than one person. */
  groupName: string
}

/**
 * 🔴 A mayor is not always LOCAL_EXEC. Asheville's is filed as LOCAL, beside the
 * council, so a district-type-only rule put "Esther E. Manheimer, Mayor" inside the
 * council card. The office title decides it too; each official is claimed once.
 */
const isMayor = (rep: PoliticianFlatRecord) => /\bmayor\b/i.test(rep.office_title) && !/vice|deputy|pro tem/i.test(rep.office_title)

const OFFICE_GROUPS: Record<ExploreLevel, readonly OfficeGroup[]> = {
  city: [
    {
      key: 'executive',
      districtTypes: ['LOCAL_EXEC', 'LOCAL'],
      pick: (rep) => rep.district_type === 'LOCAL_EXEC' || isMayor(rep),
      groupName: 'city’s elected leaders',
    },
    { key: 'council', districtTypes: ['LOCAL'], groupName: 'council members who represent this area' },
    { key: 'school-board', districtTypes: ['SCHOOL'], groupName: 'school board members who represent this area' },
  ],
  county: [
    { key: 'county', districtTypes: ['COUNTY'], groupName: 'county’s elected officials' },
  ],
  state: [
    {
      key: 'governor',
      districtTypes: ['STATE_EXEC'],
      pick: (rep) => /governor/i.test(rep.office_title) && !/lieutenant/i.test(rep.office_title),
      groupName: 'governor',
    },
    { key: 'legislature', districtTypes: ['STATE_UPPER', 'STATE_LOWER'], groupName: 'state legislators who represent this area' },
  ],
  federal: [
    { key: 'congress', districtTypes: ['NATIONAL_UPPER', 'NATIONAL_LOWER'], groupName: 'members of Congress who represent this area' },
  ],
  unified: [],
}

/** At most this many names on a card before "and N more". */
const ROSTER_NAMES = 4

function roster(holders: readonly PoliticianFlatRecord[]): string {
  const shown = holders.slice(0, ROSTER_NAMES).map((rep) => `${rep.full_name}, ${rep.office_title}`)
  const more = holders.length - shown.length
  return more > 0 ? `${shown.join('; ')}; and ${more} more` : shown.join('; ')
}

/** The essentials.empowered.vote page for one official — the record the card names. */
export function officialUrl(rep: Pick<PoliticianFlatRecord, 'id'>): string {
  return `https://essentials.empowered.vote/politician/${encodeURIComponent(rep.id)}`
}

/**
 * One starter per office group that has anyone in it. Vacant seats are left out:
 * a card that asked a vacancy for its priorities would be wrong on its face.
 */
export function officialsTopics(
  officials: readonly PoliticianFlatRecord[] | null | undefined,
  level: ExploreLevel,
  geoid: string | null,
): ExploreTopic[] {
  if (!officials || officials.length === 0) return []
  const topics: ExploreTopic[] = []
  // Each official appears on one card: the first group in order that takes them.
  const claimed = new Set<string>()

  for (const group of OFFICE_GROUPS[level]) {
    const holders = officials.filter(
      (rep) =>
        !rep.is_vacant &&
        !claimed.has(rep.id) &&
        group.districtTypes.includes(rep.district_type) &&
        (group.pick?.(rep) ?? true),
    )
    const first = holders[0]
    if (!first) continue
    for (const rep of holders) claimed.add(rep.id)

    const single = holders.length === 1
    // "Esther Manheimer" for one person; "the council members who represent this area" for several.
    const who = single ? first.full_name : `the ${group.groupName}`
    const Who = single ? first.full_name : `The ${group.groupName}`

    topics.push({
      id: `officials-${level}-${group.key}-${geoid ?? 'all'}`,
      category: single ? first.office_title : 'Elected officials',
      title: `What would you ask ${who} to make a priority?`,
      // One person: the category and title already name them. Several: the roster.
      ...(single ? {} : { blurb: roster(holders) }),
      summary: single
        ? `${first.full_name} is listed as ${first.office_title} in the public record for this place. Ask what you would want them to work on, and why.`
        : `${Who} hold office here: ${roster(holders)}. Ask what you would want them to work on, and why.`,
      question: `If you could ask ${who} to make one thing a priority, what would it be, and why?`,
      suggestedTitle: `A priority for ${who}`.slice(0, 200),
      moreQuestions: [
        `What is one decision you would want ${who} to explain in plain terms?`,
        `What would you want ${who} to hear from the people who live here?`,
        `What, if anything, would you like ${who} to keep doing?`,
        `How would you like ${who} to keep people here informed?`,
        `What question would you ask ${who} at a public meeting?`,
      ],
      level,
      geoid,
      provenance: 'derived-from-officials',
      sourceLabel: 'Public officials list',
      // One person: their own record. Several: no single page names them all, so no link.
      ...(single ? { sourceUrl: officialUrl(first) } : {}),
    })
  }

  return topics
}
