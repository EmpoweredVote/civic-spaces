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

const PILL_CLASS =
  'rounded-full bg-black/35 backdrop-blur-sm border border-white/15 text-white px-3 py-1 text-xs sm:text-sm font-medium'

export function HeroBanner({
  sliceType,
  sliceName,
  levelLabel,
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
        // Spacing and corner radius come from the card this sits in (AppShell).
        // The tagline is hidden below sm so the title and pills fit the phone floor.
        // Heights are floors, not fixed: the copy is bottom-anchored, so a long name
        // plus wrapped pills grows the banner instead of clipping the title.
        'relative overflow-hidden flex flex-col justify-end min-h-40 sm:min-h-48 md:min-h-56 lg:min-h-64',
        // 🔴 shrink-0 IS LOAD-BEARING. This renders as the first child of
        // SliceFeedPanel's `flex flex-col h-full overflow-y-auto` scroll container. A
        // flex item defaults to flex-shrink:1, and a min-height only sets a floor for
        // the box's own content — so as soon as there were posts below, the column
        // squashed the banner to nothing. It stayed in the DOM with its image loaded,
        // which is why this read as "the banner does not render on that tab" rather
        // than as a layout bug. A slice with no posts never showed it, because nothing
        // pushed.
        'shrink-0',
        // Brand-gradient ground, not flat gray: it shows through whenever no banner
        // resolves (an uncovered county, a Wikipedia miss), and it is what a visitor
        // sees for a beat while an image decodes. EV teal, light and dark together.
        'bg-gradient-to-br from-brand to-brand-hover',
        'dark:from-brand-hover dark:to-[#00212B]',
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
      {/* Kept stronger than the photo-less design wants (via-black/50, not /35): this
          banner carries a required image credit over an arbitrary Wikimedia photo, and
          a light sky behind white 11px text is the case that has to stay legible. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/15" aria-hidden="true" />

      {/* Text content — sits above gradient via z-10. The extra bottom padding keeps
          the name/pills stack clear of the credit, which is absolutely positioned
          bottom-right and may wrap to two lines. */}
      <div className="relative z-10 flex flex-col justify-end gap-2 p-4 pb-9 sm:p-6 sm:pb-8">
        <h2 className="text-xl font-bold text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.6)] sm:text-2xl md:text-3xl">
          {sliceName}
        </h2>

        {copy?.tagline && (
          <p className="hidden max-w-xl text-sm text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)] sm:block">
            {copy.tagline}
          </p>
        )}

        {/* #52 hid the first pill below md because it repeated the <h2> verbatim and
            a long name pushed the title off the top. That is moot now: the pill shows
            the level ("City"), not the name, so it no longer duplicates anything. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={PILL_CLASS}>{levelLabel}</span>
          <span className={PILL_CLASS}>
            {memberCount.toLocaleString()} {memberCount === 1 ? 'verified resident' : 'verified residents'}
          </span>
          <span className={PILL_CLASS}>Slice {siblingIndex}</span>
        </div>
      </div>

      {/* Image credit — a licence condition on the shared banner library, so it sits
          above the gradient and stays visible at every breakpoint. Bottom-right keeps
          it clear of the name/tagline/pills stack, which is bottom-left and max-w-2xl. */}
      {resolvedPhoto && credit && (
        <p
          className="absolute bottom-2 right-3 z-10 max-w-[70%] text-right text-[11px] leading-tight text-white/75"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {credit}
        </p>
      )}
    </div>
  )
}
