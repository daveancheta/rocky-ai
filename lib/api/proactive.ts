import { apiRequest } from "@/lib/api/client"

export type ProactiveEvaluationInput = {
  sessionNonce: string
  trigger: "session_start" | "observation"
  observation?: { text: string; observedAt: string; confidence: number }
  timezoneOffsetMinutes: number
  preferences: {
    enabled: boolean
    speak: boolean
    quietHoursEnabled: boolean
    quietHoursStart: string
    quietHoursEnd: string
  }
}

export type ProactiveEvaluationResult =
  | { decision: "quiet"; duplicate?: boolean; cooldown?: boolean }
  | { decision: "speak"; message: string; createdAt: string; speak: boolean }

export function evaluateProactiveEvent(input: ProactiveEvaluationInput, signal: AbortSignal) {
  return apiRequest<ProactiveEvaluationResult>("/api/companion/proactive", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  })
}
