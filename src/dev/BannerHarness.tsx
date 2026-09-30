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
import { SliceSelector } from '../components/SliceSelector'
import { bannerFor } from '../lib/banners'
import { forecastUrlFor } from '../lib/forecastLink'
import type { NextElection } from '../hooks/useNextElection'
import type { SliceType } from '../types/database'

// The real NC answer, captured 2026-09-24 (see MOCK_ELECTIONS). Harness-only.
const NC_GENERAL: NextElection = { name: 'NC 2026 Statewide General', date: '2026-11-03' }

/** A switcher with no siblings renders as the plain "Your Community" label. */
function staticSwitcher(name: string, viewOnly = false) {
  const own = { id: 'own', siblingIndex: 1, memberCount: 1234 }
  const other = { id: 'other', siblingIndex: 2, memberCount: 980 }
  return (
    <SliceSelector
      tone="image"
      locationName={name}
      ownSliceId="own"
      ownSiblingIndex={1}
      viewingSliceId={viewOnly ? 'other' : 'own'}
      siblings={viewOnly ? [own, other] : [own]}
      isLoading={false}
      isError={false}
      onSelect={() => {}}
    />
  )
}

type Case = {
  label: string
  sliceType: SliceType
  geoid: string
  name: string
  level: string
  election: NextElection | null | undefined
  viewOnly?: boolean
  location?: number
}

const CASES: Case[] = [
  { label: 'City — Asheville (curated) · election + forecast + 3 slices', sliceType: 'city', geoid: '3702140', name: 'Asheville', level: 'City', election: NC_GENERAL, location: 3214 },
  { label: 'City — Santa Monica (curated) · browsing a sibling read-only', sliceType: 'city', geoid: '0670000', name: 'Santa Monica', level: 'City', election: undefined, viewOnly: true, location: 2214 },
  { label: 'City — uncovered geoid · NO election on file', sliceType: 'city', geoid: '1836003', name: 'Indianapolis', level: 'City', election: null },
  { label: 'State — Indiana', sliceType: 'state', geoid: '18', name: 'Indiana', level: 'State', election: NC_GENERAL },
  { label: 'State — California (v2 crop)', sliceType: 'state', geoid: '06', name: 'California', level: 'State', election: undefined },
  { label: 'Federal', sliceType: 'federal', geoid: 'US', name: 'United States of America', level: 'Federal', election: NC_GENERAL },
  { label: 'County — Palm Beach (only covered county)', sliceType: 'county', geoid: '12099', name: 'Palm Beach County', level: 'County', election: NC_GENERAL },
  { label: 'County — uncovered, NO IMAGE (brand gradient)', sliceType: 'county', geoid: '18097', name: 'Monroe County', level: 'County', election: null },
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
            geoid="US"
            sliceName="United States of America"
            levelLabel="Federal"
            memberCount={6}
            switcher={staticSwitcher('United States of America')}
            nextElection={NC_GENERAL}
            forecastUrl={null}
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
              geoid={c.geoid}
              sliceName={c.name}
              levelLabel={c.level}
              memberCount={c.viewOnly ? 980 : 1234}
              locationMemberCount={c.location}
              switcher={staticSwitcher(c.name, c.viewOnly)}
              nextElection={c.election}
              forecastUrl={forecastUrlFor(c.sliceType, c.geoid, c.name)}
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
