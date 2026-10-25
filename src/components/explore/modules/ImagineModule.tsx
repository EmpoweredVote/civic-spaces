/**
 * "Imagine a better neighborhood", as a City/County module.
 *
 * Locked decision 9 keeps ImagineActivity exactly as built, so this file is a
 * wrapper and nothing else. It is place-scale by construction — a crosswalk game
 * on the Federal tab is precisely the mismatch this phase removes.
 *
 * 🔴 The module OWNS its five topics (research Finding 3 item 3). The option
 * list names topic ids, and a composition is free not to contain them, so the
 * card could otherwise offer "Explore this topic" for a topic that resolves to
 * nothing. They are read through lib/exploreData and are deliberately NOT in
 * GENERIC_TOPICS.city: a topic in both would render as a question card AND
 * inside Imagine on the same page, which selectForModules cannot see because a
 * module's own topics() never passes through it. Check 40 asserts the sets are
 * disjoint.
 */

import { getImagineTopics } from '../../../lib/exploreData'
import type { ExploreTopic } from '../../../types/explore'
import { ImagineActivity } from '../ExploreActivities'
import type { ExploreCtx } from '../ExploreContext'
import { IMAGINE_OPTIONS } from '../exploreContent'

export function ImagineModule({ ctx }: { ctx: ExploreCtx }) {
  const imagineTopic = IMAGINE_OPTIONS.find((o) => o.key === ctx.ui.imagine)?.topic ?? null
  return (
    <ImagineActivity
      choice={ctx.ui.imagine}
      onChoose={(imagine) => ctx.setUi({ imagine })}
      ideaText={imagineTopic ? ctx.draftFor(imagineTopic).body : ''}
      onIdeaChange={(body) => {
        if (imagineTopic) ctx.saveDraft(imagineTopic, { body })
      }}
      onExploreTopic={ctx.openTopic}
      onShareIdea={ctx.startConversation}
      isAuthenticated={ctx.isAuthenticated}
    />
  )
}

/** The five topics IMAGINE_OPTIONS[].topic names, as full records. */
export function imagineModuleTopics(): ExploreTopic[] {
  return getImagineTopics()
}
