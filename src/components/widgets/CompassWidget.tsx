import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { CompassCategory, CompassAnswer } from '../../types/compass'
import { buildChartData } from '../../hooks/useCompassData'
import { WidgetCard } from './WidgetCard'

interface CompassWidgetProps {
  categories: CompassCategory[]
  answers: CompassAnswer[]
  isLoading: boolean
  isUncalibrated: boolean
}

function CompassIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="w-10 h-10 text-purple-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" />
      {/* Cardinal points */}
      <line x1="24" y1="4" x2="24" y2="10" strokeWidth="2.5" />
      <line x1="24" y1="38" x2="24" y2="44" strokeWidth="2.5" />
      <line x1="4" y1="24" x2="10" y2="24" strokeWidth="2.5" />
      <line x1="38" y1="24" x2="44" y2="24" strokeWidth="2.5" />
      {/* Needle */}
      <polygon points="24,12 21,24 24,36 27,24" fill="#7c3aed" stroke="none" />
      <circle cx="24" cy="24" r="2" fill="#7c3aed" />
    </svg>
  )
}

export function CompassWidget({ categories, answers, isLoading, isUncalibrated }: CompassWidgetProps) {
  if (isLoading) {
    return (
      <WidgetCard title="Issue Alignment Compass">
        <Skeleton circle height={160} width={160} className="mx-auto block" />
      </WidgetCard>
    )
  }

  const chartData = buildChartData(categories, answers)
  const showPrompt = isUncalibrated || chartData.length === 0

  if (showPrompt) {
    return (
      <WidgetCard title="Issue Alignment Compass">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CompassIcon />
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
            Discover where you stand on the issues that matter to your community.
          </p>
          <a
            href="https://compassv2.empowered.vote/results"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Calibrate Now
          </a>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Issue Alignment Compass">
      <ResponsiveContainer width="100%" aspect={1}>
        <RadarChart data={chartData} outerRadius="75%">
          <PolarGrid />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
          <Radar
            name="Your Compass"
            dataKey="value"
            fill="#7c3aed"
            fillOpacity={0.35}
            stroke="#7c3aed"
            strokeWidth={2}
          />
          <Tooltip formatter={(value: number | string) => [Number(value).toFixed(1), 'Your Compass']} />
        </RadarChart>
      </ResponsiveContainer>
    </WidgetCard>
  )
}
