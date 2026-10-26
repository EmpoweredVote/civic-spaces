/**
 * The featured topic — the one card at the top of a composition.
 *
 * Re-seated from ExploreView.tsx:215-247 with three changes and no restyling:
 *   1. The topic is resolved through ctx.topicsById and may be missing, because
 *      TopicId is a string since 16-01. Rendering nothing is the honest answer.
 *   2. The hard-coded "Sample topic" badge is now driven by topic.provenance.
 *   3. The drawn fallback (WalkingScene) is a STREET. It is right for a city or
 *      a county and contradicts the heading on State, Federal and Unified, so
 *      those levels get a single-column card rather than a street they are not
 *      about. Flagged for the four-way pass in 16-10.
 */

import { creditParts } from '../../../lib/banners'
import { WalkingScene } from '../NeighborhoodScene'
import type { ExploreCtx } from '../ExploreContext'
import { ArrowIcon, CARD, PrimaryButton } from '../exploreUi'
import { ProvenanceTag } from '../provenance'

/**
 * The credit is a licence condition, so it is always shown.
 *
 * A copy of ExploreView's private PhotoCredit (`:37-51`). 16-03 deletes that
 * file's inline featured section and this becomes the only one; this plan does
 * not touch ExploreView, so the duplication lives for exactly one plan.
 */
function PhotoCredit({ credit }: { credit: string }) {
  const parts = creditParts(credit)
  return (
    <p className="absolute bottom-0 inset-x-0 px-3 py-1.5 text-[10px] text-white/90 bg-gradient-to-t from-black/60 to-transparent truncate">
      {parts ? (
        <>
          Photo: {parts.author} ·{' '}
          {parts.licenseUrl ? (
            <a href={parts.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{parts.license}</a>
          ) : parts.license}
        </>
      ) : credit}
    </p>
  )
}

export function FeaturedModule({ ctx }: { ctx: ExploreCtx }) {
  const { composition, featuredPhoto } = ctx
  const featured = composition.featuredTopicId ? ctx.topicsById.get(composition.featuredTopicId) : undefined
  if (!featured) return null

  const isPlaceLevel = composition.level === 'city' || composition.level === 'county'
  const showImagePanel = !!featuredPhoto || isPlaceLevel

  return (
    <article
      aria-labelledby="explore-featured-title"
      className={`${CARD} overflow-hidden grid ${showImagePanel ? '@lg:grid-cols-2' : ''}`}
    >
      {showImagePanel && (
        <div className="relative aspect-[16/10] @lg:aspect-auto @lg:min-h-[19rem] bg-brand-muted dark:bg-gray-800">
          {featuredPhoto ? (
            <img
              src={featuredPhoto.url}
              alt={featuredPhoto.alt}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0"><WalkingScene /></div>
          )}
          <ProvenanceTag topic={featured} variant="badge" className="absolute top-3 left-3" />
          {featuredPhoto && <PhotoCredit credit={featuredPhoto.credit} />}
        </div>
      )}
      <div className="p-5 @lg:p-8 flex flex-col justify-center gap-3">
        {/* With no image panel the badge has nothing to sit on, so it leads the text. */}
        {!showImagePanel && <div><ProvenanceTag topic={featured} /></div>}
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">{featured.category}</p>
        <h3 id="explore-featured-title" className="text-2xl @2xl:text-[2rem] font-medium leading-[1.15] tracking-tight text-gray-900 dark:text-gray-100">
          {featured.title}
        </h3>
        <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">{featured.summary}</p>
        <div className="mt-2">
          <PrimaryButton size="lg" onClick={() => ctx.openTopic(featured.id)}>
            Explore this topic <ArrowIcon />
          </PrimaryButton>
        </div>
      </div>
    </article>
  )
}
