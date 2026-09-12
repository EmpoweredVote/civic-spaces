/**
 * THROWAWAY visual harness for HeroBanner — not part of the app.
 *
 * The hero only renders for a signed-in member with slices, and useAuth hardcodes
 * the login redirect to production, so the banner cannot be reached on localhost by
 * clicking. This page mounts HeroBanner directly with real bannerFor() output so the
 * light/dark x desktop/mobile check can run without credentials.
 *
 * Served at /banner-harness.html in dev only; `vite build` never sees it.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { HeroBanner } from '../components/HeroBanner'
import { bannerFor } from '../lib/banners'
import type { SliceType } from '../types/database'

const CASES: Array<{ label: string; sliceType: SliceType; geoid: string; name: string }> = [
  { label: 'State — Indiana', sliceType: 'state', geoid: '18', name: 'Indiana' },
  { label: 'State — California (v2 crop)', sliceType: 'state', geoid: '06', name: 'California' },
  { label: 'Federal', sliceType: 'federal', geoid: '1807', name: 'United States of America' },
  { label: 'County — Palm Beach (only covered county)', sliceType: 'county', geoid: '12099', name: 'Palm Beach' },
  { label: 'County — uncovered, NO IMAGE (brand gradient)', sliceType: 'county', geoid: '18097', name: 'Monroe' },
]

/**
 * Reproduces SliceFeedPanel's scroll container EXACTLY: `flex flex-col h-full
 * overflow-y-auto` with the banner as first child and posts below. This is the case
 * that broke — with content below, a flex column shrinks the banner (flex-shrink
 * defaults to 1) even though aspect-ratio gives it a definite height.
 */
function FeedSimulation() {
  const banner = bannerFor('federal', '1807')
  return (
    <section className="mb-8">
      <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        FEED SIMULATION — banner + posts in a flex-col scroll container
      </h3>
      <div className="h-[420px] border border-red-400">
        <div className="flex flex-col h-full overflow-y-auto">
          <HeroBanner
            sliceType="federal"
            sliceName="United States of America"
            memberCount={6}
            siblingIndex={1}
            photoUrl={banner ? banner.url : null}
            credit={banner ? banner.credit : null}
          />
          <div className="px-4 py-2 text-sm font-medium text-gray-500">Federal #1</div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="m-3 rounded border border-gray-200 p-4 dark:border-gray-700">
              <p className="font-medium text-gray-900 dark:text-gray-100">Poster {i + 1}</p>
              <p className="mt-2 text-gray-700 dark:text-gray-300">
                A post body long enough to give the column something to push against, which is
                the whole point of this case.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Harness() {
  return (
    <div className="mx-auto max-w-6xl bg-white p-4 dark:bg-gray-900">
      <FeedSimulation />
      {CASES.map((c) => {
        const banner = bannerFor(c.sliceType, c.geoid)
        return (
          <section key={c.label} className="mb-8">
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {c.label}
              {!banner && ' — bannerFor() returned null'}
            </h3>
            <HeroBanner
              sliceType={c.sliceType}
              sliceName={c.name}
              memberCount={1234}
              siblingIndex={1}
              photoUrl={banner ? banner.url : null}
              credit={banner ? banner.credit : null}
            />
          </section>
        )
      })}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>
)
