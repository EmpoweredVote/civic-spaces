/**
 * "What's new" — product release notes, not slice content.
 *
 * Identical on every level, and last in every composition. WhatsNewCard is also
 * mounted in the right sidebar (AppShell.tsx:1146), which is why the card takes
 * `className` and hides itself from md up when the sidebar already has it; do
 * not change the component for Explore's sake.
 */

import { WhatsNewCard } from '../WhatsNewCard'
import type { ExploreCtx } from '../ExploreContext'

export function WhatsNewModule({ ctx }: { ctx: ExploreCtx }) {
  return <WhatsNewCard className={ctx.whatsNewInSidebar ? 'md:hidden' : ''} onGoTo={ctx.onGoToView} />
}
