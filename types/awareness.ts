export type AwarenessCategory = "Environment" | "A gentle nudge" | "A remembered goal"

export type AwarenessObservation = {
  id: string
  category: AwarenessCategory
  message: string
  time: string
  isDemo: true
}
