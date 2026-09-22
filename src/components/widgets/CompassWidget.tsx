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

export function CompassWidget({ categories, answers, isLoading, isUncalibrated }: CompassWidgetProps) {
  if (isLoading) {
    return (
      <WidgetCard title="Issue Alignment Compass">
        <Skeleton circle height={160} width={160} className="mx-auto block" />
      </WidgetCard>
    )
  }

  const chartData = buildChartData(categories, answers)

  // Uncalibrated users get no card here rather than a "Calibrate Now" nudge —
  // Compass is already a discoverable Inform Tool in the nav; once a user has
  // real compass data, the personalized radar chart below is worth the space.
  if (isUncalibrated || chartData.length === 0) {
    return null
  }

  return (
    <WidgetCard title="Issue Alignment Compass">
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={chartData} outerRadius="75%">
          <PolarGrid />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
          <Radar
            name="Your Compass"
            dataKey="value"
            fill="#005366"
            fillOpacity={0.35}
            stroke="#005366"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Tooltip formatter={(value: number | string) => [Number(value).toFixed(1), 'Your Compass']} />
        </RadarChart>
      </ResponsiveContainer>
    </WidgetCard>
  )
}
