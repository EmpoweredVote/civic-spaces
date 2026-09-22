/**
 * Shapes served by `api.empowered.vote/api/compass`.
 *
 * A stance's `value` is its position on that topic's scale, 1..stances.length
 * (every topic currently has 5). 0 or absent means the member has not answered.
 * RadarChartCore normalises with `value / stances.length * 10`, so every spoke
 * lands on the same 0..10 domain and two people's compasses are comparable.
 */
export interface CompassStance {
  id: string
  value: number
  text: string
}

export interface CompassTopic {
  id: string
  short_title: string
  title: string
  stances: CompassStance[]
}

export interface CompassAnswer {
  topic_id: string
  value: number
  /**
   * Display-only: reverses which end of this spoke reads as "high". It never
   * changes the stored value, which stays on the canonical stance scale — see
   * CompassV2's ComparePanel. Kept here because the chart takes it as a prop.
   */
  inverted?: boolean
  write_in_text?: string | null
}

/** Spoke values keyed the way RadarChartCore wants them. */
export type CompassSpokes = Record<string, number>
export type InvertedSpokes = Record<string, boolean>
