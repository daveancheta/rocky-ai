export const MIN_VISION_CONFIDENCE = 0.82

export type VisionObject = {
  name: string
  location: string
  confidence: number
}

export type VisionSnapshot = {
  summary: string
  confidence: number
  objects: VisionObject[]
}

export type VisionChange = {
  signature: string
  confidence: number
  text: string
}

export function isUsableVisionObservation(
  snapshot: VisionSnapshot | undefined,
  observedAt: string,
  now = Date.now(),
  maxAgeMs = 3 * 60_000,
) {
  const age = now - Date.parse(observedAt)
  return Boolean(
    snapshot &&
    snapshot.confidence >= MIN_VISION_CONFIDENCE &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= maxAgeMs,
  )
}

export function isVisualAwarenessQuestion(message: string) {
  return /\b(?:what|where|which|who|how|can|could|do|did|am|is|are|describe|tell me|find|locate|show|notice)\b.{0,90}\b(?:see|visible|look|room|surroundings|environment|desk|screen|monitor|book|paper|phone|cup|mug|object|camera|image|picture|doing|activity|holding|reading|writing|typing|smil\w*|frown\w*|expression|face|scene|setup)\b/i.test(message) ||
    /\b(?:what do you see|what can you see|what(?:'s| is) around me|what am i doing|what am i holding|how do i look|where(?:'s| is| are)\b)/i.test(message)
}

function confidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

export function parseVisionSnapshot(output: string): VisionSnapshot | undefined {
  const start = output.indexOf("{")
  const end = output.lastIndexOf("}")
  if (start < 0 || end <= start) return undefined

  try {
    const value: unknown = JSON.parse(output.slice(start, end + 1))
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
    const record = value as Record<string, unknown>
    if (
      typeof record.summary !== "string" || !record.summary.trim() || record.summary.length > 1_200 ||
      !confidence(record.confidence) || !Array.isArray(record.objects) || record.objects.length > 40
    ) return undefined

    const objects: VisionObject[] = []
    for (const candidate of record.objects) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined
      const item = candidate as Record<string, unknown>
      if (
        typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 ||
        typeof item.location !== "string" || item.location.length > 100 ||
        !confidence(item.confidence)
      ) return undefined
      objects.push({ name: item.name.trim(), location: item.location.trim(), confidence: item.confidence })
    }
    return { summary: record.summary.trim(), confidence: record.confidence, objects }
  } catch {
    return undefined
  }
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ")
}

export function detectVisionChanges(previous: VisionSnapshot | undefined, current: VisionSnapshot): VisionChange[] {
  if (!previous || previous.confidence < MIN_VISION_CONFIDENCE || current.confidence < MIN_VISION_CONFIDENCE) return []
  const prior = new Map(previous.objects.map((object) => [normalize(object.name), object]))
  const latest = new Map(current.objects.map((object) => [normalize(object.name), object]))
  const changes: VisionChange[] = []

  for (const [key, object] of latest) {
    const before = prior.get(key)
    if (object.confidence < MIN_VISION_CONFIDENCE) continue
    if (!before) {
      changes.push({
        signature: `appeared:${key}`,
        confidence: Math.min(current.confidence, object.confidence),
        text: `A ${object.name} is visible in the latest still image and was not listed in the previous successful observation.`,
      })
      continue
    }
    if (
      before.confidence >= MIN_VISION_CONFIDENCE && object.location && before.location &&
      normalize(object.location) !== normalize(before.location)
    ) {
      changes.push({
        signature: `position:${key}:${normalize(before.location)}:${normalize(object.location)}`,
        confidence: Math.min(previous.confidence, current.confidence, before.confidence, object.confidence),
        text: `The ${object.name} appears in the ${object.location} area in the latest still image; it was previously described in the ${before.location} area.`,
      })
    }
  }

  for (const [key, object] of prior) {
    if (latest.has(key) || object.confidence < MIN_VISION_CONFIDENCE) continue
    changes.push({
      signature: `not-visible:${key}`,
      confidence: Math.min(previous.confidence, current.confidence, object.confidence),
      text: `The ${object.name} was not listed in the latest still image, though it was visible in the previous one; it may simply be outside the current frame.`,
    })
  }
  return changes.filter((change) => change.confidence >= MIN_VISION_CONFIDENCE)
}

export function filterNewVisionChanges(changes: VisionChange[], seen: Map<string, number>, now: number, cooldownMs = 15 * 60_000) {
  for (const [signature, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(signature)
  }
  return changes.filter((change) => {
    if (seen.has(change.signature)) return false
    seen.set(change.signature, now + cooldownMs)
    return true
  })
}
