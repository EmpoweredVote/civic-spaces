import { useState } from 'react'
import type { SliceType } from '../types/database'
import { BANNER_DEFAULTS, LEVEL_LABELS } from '../lib/bannerImages'

interface HeroBannerProps {
  sliceType: SliceType
  sliceName: string
  memberCount: number
  siblingIndex: number
  /** Curated per-jurisdiction photo from `slices.photo_url`, when set — takes priority over the type default. */
  photoUrl?: string | null
}

const PILL_CLASS =
  'rounded-full bg-black/35 backdrop-blur-sm border border-white/15 text-white px-3 py-1 text-xs sm:text-sm font-medium'

/**
 * Full-width photo banner for a civic space. Falls back to a brand-colored
 * gradient (no photo) when neither the DB photo nor the type default loads —
 * every slice type still gets a readable, on-brand banner.
 */
export function HeroBanner({ sliceType, sliceName, memberCount, siblingIndex, photoUrl }: HeroBannerProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const defaults = BANNER_DEFAULTS[sliceType]
  const resolvedPhoto = imgFailed ? null : photoUrl ?? defaults?.defaultPhoto ?? null

  return (
    <div className="relative h-40 sm:h-48 md:h-56 lg:h-64 w-full shrink-0 overflow-hidden">
      {resolvedPhoto ? (
        <img
          src={resolvedPhoto}
          alt=""
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-hover dark:from-gray-800 dark:to-gray-950" />
      )}

      {/* Dark gradient overlay — keeps the text readable over any photo, in either theme */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col justify-end gap-2 p-4 sm:p-6">
        <h2 className="text-xl font-bold text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.6)] sm:text-2xl md:text-3xl">
          {sliceName}
        </h2>
        {defaults?.tagline && (
          <p className="hidden max-w-xl text-sm text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)] sm:block">
            {defaults.tagline}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className={PILL_CLASS}>{LEVEL_LABELS[sliceType]}</span>
          <span className={PILL_CLASS}>
            {memberCount.toLocaleString()} {memberCount === 1 ? 'verified resident' : 'verified residents'}
          </span>
          <span className={PILL_CLASS}>Slice {siblingIndex}</span>
        </div>
      </div>
    </div>
  )
}
