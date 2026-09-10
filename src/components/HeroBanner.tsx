import type { SliceType } from '../types/database'
import { SLICE_COPY } from '../lib/sliceCopy'

interface HeroBannerProps {
  sliceType: SliceType
  sliceName: string
  memberCount: number
  siblingIndex: number
  photoUrl?: string | null
  /**
   * Attribution for `photoUrl`, rendered bottom-right.
   *
   * 🔴 NOT DECORATION. The shared banner library is Wikimedia-sourced and most of it
   * is CC BY or CC BY-SA, which require the author be named visibly. If a caller has
   * a credit, this component must display it — do not hide it behind a hover, a
   * breakpoint, or a colour too faint to read.
   */
  credit?: string | null
}

export function HeroBanner({
  sliceType,
  sliceName,
  memberCount,
  siblingIndex,
  photoUrl,
  credit,
}: HeroBannerProps) {
  const copy = SLICE_COPY[sliceType]

  // undefined = still loading — don't show defaultPhoto yet (avoids flash of wrong image)
  // null      = loaded, no wiki image — fall back to defaultPhoto
  const resolvedPhoto = photoUrl === undefined
    ? null
    : (photoUrl ?? copy?.defaultPhoto ?? null)

  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl mx-4 mt-4 md:mx-0 md:mt-0',
        'aspect-[16/9] md:aspect-[16/5]',
        // Brand-gradient ground, not flat gray: it shows through whenever no banner
        // resolves (an uncovered county, a Wikipedia miss), and it is what a visitor
        // sees for a beat while an image decodes. EV teal, light and dark together.
        'bg-gradient-to-br from-[#00657C] to-[#004453]',
        'dark:from-[#004453] dark:to-[#00212B]',
        'dark:ring-1 dark:ring-white/10',
      ]
        .join(' ')}
    >
      {/* Background image — fades in once loaded to avoid jarring flash */}
      {resolvedPhoto && (
        <img
          src={resolvedPhoto}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
          style={{ opacity: 0 }}
          onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }}
        />
      )}

      {/* Gradient: strong at bottom where text lives, fades to near-transparent at top */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />

      {/* Text content — sits above gradient via z-10 */}
      <div
        className="relative z-10 flex h-full flex-col justify-end p-6 md:p-8"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
      >
        {/* Slice name */}
        <h2 className="text-2xl font-bold text-white md:text-3xl">{sliceName}</h2>

        {/* Tagline */}
        <p className="mt-1 text-sm text-white/90 md:text-base">{copy?.tagline}</p>

        {/* Pill badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Jurisdiction pill */}
          <span className="rounded-full bg-black/30 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white">
            {sliceName}
          </span>

          {/* Member count pill */}
          <span className="rounded-full bg-black/30 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white">
            {memberCount.toLocaleString()} verified residents
          </span>

          {/* Slice number pill */}
          <span className="rounded-full bg-black/30 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white">
            Slice {siblingIndex}
          </span>
        </div>

        {/* Description — hidden on mobile to prevent overflow; visible on desktop */}
        <p className="hidden md:block mt-3 max-w-2xl text-xs leading-relaxed text-white/80 md:text-sm">
          {copy?.description}
        </p>
      </div>

      {/* Image credit — a licence condition on the shared banner library, so it sits
          above the gradient and stays visible at every breakpoint. Bottom-right keeps
          it clear of the name/tagline/pills stack, which is bottom-left and max-w-2xl. */}
      {resolvedPhoto && credit && (
        <p
          className="absolute bottom-2 right-3 z-10 text-[11px] leading-none text-white/75"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {credit}
        </p>
      )}
    </div>
  )
}
