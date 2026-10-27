import { connection } from "next/server"
import { MetaModelApiError } from "@/lib/ai/meta-provider"
import { readBoundedJson } from "@/lib/api/read-json"
import {
  evaluateProactiveMessage,
  type ProactivePreferences,
  type ProactiveTrigger,
} from "@/lib/companion/proactive"
import { getChatSessionId } from "@/lib/chat/session"

const MAX_REQUEST_BYTES = 12 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const activeSessions = new Set<string>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isClockTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(":").map(Number)
  return hours < 24 && minutes < 60
}

function parseRequest(value: unknown): {
  sessionNonce: string
  trigger: ProactiveTrigger
  observation?: { text: string; observedAt: string; confidence: number }
  timezoneOffsetMinutes: number
  preferences: ProactivePreferences
} | undefined {
  if (!isRecord(value) || !isRecord(value.preferences)) return undefined
  const preferences = value.preferences
  if (
    typeof value.sessionNonce !== "string" || !UUID_PATTERN.test(value.sessionNonce) ||
    (value.trigger !== "session_start" && value.trigger !== "observation") ||
    typeof value.timezoneOffsetMinutes !== "number" ||
    !Number.isInteger(value.timezoneOffsetMinutes) ||
    Math.abs(value.timezoneOffsetMinutes) > 840 ||
    typeof preferences.enabled !== "boolean" ||
    typeof preferences.speak !== "boolean" ||
    typeof preferences.quietHoursEnabled !== "boolean" ||
    !isClockTime(preferences.quietHoursStart) ||
    !isClockTime(preferences.quietHoursEnd)
  ) return undefined

  let observation: { text: string; observedAt: string; confidence: number } | undefined
  if (value.trigger === "observation") {
    if (!isRecord(value.observation) || typeof value.observation.text !== "string" ||
      value.observation.text.trim().length < 1 || value.observation.text.length > 8_000 ||
      typeof value.observation.observedAt !== "string" ||
      !Number.isFinite(Date.parse(value.observation.observedAt)) ||
      typeof value.observation.confidence !== "number" || !Number.isFinite(value.observation.confidence) ||
      value.observation.confidence < 0 || value.observation.confidence > 1) return undefined
    observation = {
      text: value.observation.text.trim(),
      observedAt: value.observation.observedAt,
      confidence: value.observation.confidence,
    }
  }

  return {
    sessionNonce: value.sessionNonce,
    trigger: value.trigger,
    observation,
    timezoneOffsetMinutes: value.timezoneOffsetMinutes,
    preferences: {
      enabled: preferences.enabled,
      speak: preferences.speak,
      quietHoursEnabled: preferences.quietHoursEnabled,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
    },
  }
}

function getProviderError(error: MetaModelApiError) {
  if (!error.status) {
    return Response.json({ error: "Muse Spark is not configured or could not be reached." }, { status: 503 })
  }
  if (error.status === 401 || error.status === 403 || error.status === 404) {
    return Response.json({ error: "Muse Spark is not available for proactive messages." }, { status: 503 })
  }
  if (error.status === 429) {
    return Response.json({ error: "Muse Spark is busy. ROCKY will stay quiet for now." }, { status: 503 })
  }
  return Response.json({ error: "ROCKY could not evaluate a proactive message." }, { status: 502 })
}

export async function POST(request: Request) {
  await connection()
  const body = await readBoundedJson(request, MAX_REQUEST_BYTES)
  if (!body.success) return body.response
  const parsed = parseRequest(body.value)
  if (!parsed) return Response.json({ error: "Invalid proactive evaluation request." }, { status: 400 })
  if (!parsed.preferences.enabled) return Response.json({ decision: "quiet" })

  let sessionId: string
  try {
    sessionId = await getChatSessionId()
  } catch {
    return Response.json({ error: "ROCKY could not identify this browser session." }, { status: 503 })
  }
  if (activeSessions.has(sessionId)) return Response.json({ decision: "quiet", duplicate: true })
  activeSessions.add(sessionId)

  try {
    const result = await evaluateProactiveMessage({
      ...parsed,
      sessionId,
      signal: request.signal,
    })
    if (request.signal.aborted) return new Response(null, { status: 499 })
    return Response.json(result)
  } catch (error) {
    if (error instanceof MetaModelApiError) {
      console.error("Muse Spark proactive evaluation failed.", { status: error.status ?? null })
      return getProviderError(error)
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return Response.json({ error: "ROCKY's proactive check timed out and stayed quiet." }, { status: 504 })
    }
    if (request.signal.aborted) return new Response(null, { status: 499 })
    console.error("Proactive companion evaluation failed.")
    return Response.json({ error: "ROCKY could not evaluate this context." }, { status: 503 })
  } finally {
    activeSessions.delete(sessionId)
  }
}
