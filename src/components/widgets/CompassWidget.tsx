import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
// @ts-expect-error — ev-ui ships no type declarations for RadarChartCore yet.
import { RadarChartCore } from '@empoweredvote/ev-ui'
import { WidgetCard } from './WidgetCard'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import type { CompassData } from '../../hooks/useCompassData'

/**
 * The member's Issue Alignment Compass, drawn with ev-ui's RadarChartCore —
 * the same component Compass itself renders, rather than a second radar of our
 * own. That keeps one visual language across EV surfaces, needs no charting
 * dependency here, and means the two-polygon comparison view is a `compareData`
 * prop away rather than a rewrite (see CompassV2's OVERLAPPING-COMPASS-SPEC.md).
 *
 * RadarChartCore normalises each spoke by its own topic's stance count
 * (`value / stances.length * 10`), so the radius is a fixed 0..10 domain and two
 * people's compasses can be laid over each other meaningfully.
 *
 * It reads the `dark` class off <html> through its own internal hook, so it
 * follows this app's theme with nothing passed in.
 */
export function CompassWidget({ topics, spokes, invertedSpokes, isLoading, isUncalibrated }: CompassData) {
  const isDark = useIsDarkMode()

  if (isLoading) {
    return (
      <WidgetCard title="Your Compass">
        <Skeleton circle height={180} width={180} className="mx-auto block" />
      </WidgetCard>
    )
  }

  // No nudge to calibrate here: Compass is already one of the Inform Tools in
  // the nav rail, and an empty chart in a sidebar teaches nothing.
  if (isUncalibrated) return null

  return (
    <WidgetCard title="Your Compass">
      <div className="flex flex-col items-center gap-3">
        <RadarChartCore
          topics={topics}
          data={spokes}
          invertedSpokes={invertedSpokes}
          size={240}
          // tightFit crops the viewBox to the spoke endpoints, which cuts the
          // second line off any label at the bottom of the circle. The plain
          // vertical padding leaves room for two-line labels instead.
          padding={40}
          labelOffset={12}
          labelFontSize={11}
          maxLabelLines={2}
          dotRadius={3}
        />
        <a
          href="https://compass.empowered.vote/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-brand hover:underline dark:text-brand-light"
        >
          Open your full compass
        </a>
      </div>
      {/* The chart's own labels carry the topic names; this is for a screen
          reader, which gets nothing useful out of the SVG. */}
      <p className="sr-only">
        Your compass across {Object.keys(spokes).length} topics
        {isDark ? ', dark theme' : ''}:{' '}
        {Object.entries(spokes)
          .map(([topic, value]) => `${topic} ${value} of 5`)
          .join(', ')}
        .
      </p>
    </WidgetCard>
  )
}
