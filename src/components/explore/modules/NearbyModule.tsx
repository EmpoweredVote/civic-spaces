/**
 * "Explore nearby" — the place half of the old Adventure card.
 *
 * City/County only: a fifteen-minute walk to look at a crossing is not a thing
 * a State or Federal space can suggest.
 *
 * 🔴 Like Imagine, the module OWNS the three topics its suggestions name, read
 * through lib/exploreData. A composition is free not to list them, and a
 * suggestion whose "Explore this topic" link resolves to nothing is a dead
 * control. They are deliberately not in GENERIC_TOPICS — check 40 asserts it.
 */

import { getAdventureTopics } from '../../../lib/exploreData'
import type { ExploreTopic } from '../../../types/explore'
import { NearbyActivity } from '../ExploreActivities'
import type { ExploreCtx } from '../ExploreContext'

export function NearbyModule({ ctx }: { ctx: ExploreCtx }) {
  return (
    <div className="pt-2">
      <NearbyActivity
        choice={ctx.ui.adventure}
        onChoose={(adventure) => ctx.setUi({ adventure })}
        onExploreTopic={ctx.openTopic}
      />
    </div>
  )
}

/** The three topics ADVENTURE_OPTIONS[].topic names, as full records. */
export function nearbyModuleTopics(): ExploreTopic[] {
  return getAdventureTopics()
}
