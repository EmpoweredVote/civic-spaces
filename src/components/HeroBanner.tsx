import type { SliceType } from '../types/database'
import { SLICE_COPY } from '../lib/sliceCopy'

interface HeroBannerProps {
  sliceType: SliceType
  sliceName: string
  geoid: string
  memberCount: number
  siblingIndex: number
}

const SLICE_LEVEL_LABELS: Record<SliceType, string> = {
  neighborhood: 'Neighborhood Level',
  local: 'Local Level',
  state: 'State Level',
  federal: 'Federal Level',
  unified: 'Unified',
  volunteer: 'Volunteer',
}

export function HeroBanner({
  sliceType,
  sliceName,
  geoid,
  memberCount,
  siblingIndex,
}: HeroBannerProps) {
  const copy = SLICE_COPY[sliceType]
  const photoUrl = copy?.placeholderPhoto ?? null

  const bgStyle = photoUrl
    ? { backgroundImage: `url(${photoUrl})` }
    : undefined

  const fallbackBg = photoUrl ? '' : 'bg-gray-700 dark:bg-gray-800'

  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl mx-4 mt-4 md:mx-0 md:mt-0',
        'aspect-[16/9] md:aspect-[16/5]',
        'bg-cover bg-center',
        fallbackBg,
        'dark:ring-1 dark:ring-white/10',
      ]
        .filter(Boolean)
        .join(' ')}
      style={bgStyle}
    >
      {/* Gradient overlay — dark at bottom, transparent at top */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

      {/* Text content — sits above gradient via z-10 */}
      <div className="relative z-10 flex h-full flex-col justify-end p-6 md:p-8">
        {/* Slice name */}
        <h2 className="text-2xl font-bold text-white md:text-3xl">{sliceName}</h2>

        {/* Tagline */}
        <p className="mt-1 text-sm text-white/90 md:text-base">{copy?.tagline}</p>

        {/* Pill badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Level pill */}
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {SLICE_LEVEL_LABELS[sliceType]}
          </span>

          {/* Jurisdiction pill — Phase 10 resolves geoid to a human name */}
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {geoid}
          </span>

          {/* Member count pill */}
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {memberCount.toLocaleString()} verified residents
          </span>

          {/* Slice number pill */}
          {/* TODO Phase 10: add siblingTotal when available */}
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            Slice {siblingIndex}
          </span>
        </div>

        {/* Description */}
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-white/80 md:text-sm">
          {copy?.description}
        </p>
      </div>
    </div>
  )
}
