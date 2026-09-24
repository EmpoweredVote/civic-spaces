import type { SliceType } from '../types/database'
import { SLICE_COPY } from '../lib/sliceCopy'

interface HeroBannerProps {
  sliceType: SliceType
  sliceName: string
  /** The level's tab label ("City", "Federal", …) — the first pill. */
  levelLabel: string
  memberCount: number
  siblingIndex: number
  photoUrl?: string | null
}

const PILL_CLASS =
  'rounded-full bg-black/35 backdrop-blur-sm border border-white/15 text-white px-3 py-1 text-xs sm:text-sm font-medium'

export function HeroBanner({
  sliceType,
  sliceName,
  levelLabel,
  memberCount,
  siblingIndex,
  photoUrl,
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
        // Spacing and corner radius come from the card this sits in (AppShell).
        // The tagline is hidden below sm so the title and pills fit the phone floor.
        // Heights are floors, not fixed (matching #87): the copy is bottom-anchored, so a
        // long name plus wrapped pills grows the banner instead of clipping the title.
        'relative overflow-hidden flex flex-col justify-end min-h-40 sm:min-h-48 md:min-h-56 lg:min-h-64',
        'bg-gray-700 dark:bg-gray-800',
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" aria-hidden="true" />

      {/* Text content — sits above gradient via z-10 */}
      <div className="relative z-10 flex flex-col justify-end gap-2 p-4 sm:p-6">
        <h2 className="text-xl font-bold text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.6)] sm:text-2xl md:text-3xl">
          {sliceName}
        </h2>

        {copy?.tagline && (
          <p className="hidden max-w-xl text-sm text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)] sm:block">
            {copy.tagline}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className={PILL_CLASS}>{levelLabel}</span>
          <span className={PILL_CLASS}>
            {memberCount.toLocaleString()} {memberCount === 1 ? 'verified resident' : 'verified residents'}
          </span>
          <span className={PILL_CLASS}>Slice {siblingIndex}</span>
        </div>
      </div>
    </div>
  )
}
