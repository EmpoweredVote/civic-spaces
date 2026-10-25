/**
 * "Coming up" — the real-event half of the old Adventure card.
 *
 * Not place-scale, which is why the split was worth doing: an election is
 * meaningful on State and Federal, and until 16-07 it is the only real content
 * some levels have. Unified has no calendar and the composition omits this
 * module entirely.
 *
 * Both sources are real or absent: the meetings API's next scheduled meeting,
 * else the area's next election. Nothing here is invented, and when neither
 * answers the registry's reserved room says the calendar is empty.
 */

import { ComingUpCard } from '../ExploreActivities'
import type { ExploreCtx } from '../ExploreContext'

export function ComingUpModule({ ctx }: { ctx: ExploreCtx }) {
  return (
    <ComingUpCard
      meeting={ctx.meetings?.[0] ?? null}
      election={ctx.elections?.[0] ?? null}
      level={ctx.composition.level}
    />
  )
}
