export interface CompassCategory {
  id: string
  title: string
  topics: Array<{
    id: string
    title: string
    short_title: string | null
    question_text: string
  }>
}

export interface CompassAnswer {
  topic_id: string
  value: number
  write_in_text: string | null
  visibility: string
  inverted: boolean
  updated_at: string
}
