export function isQuietTime(
  localTime: string,
  enabled: boolean,
  start: string,
  end: string,
) {
  if (!enabled || !/^\d{2}:\d{2}$/.test(localTime) || start === end) return false
  const toMinutes = (value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return undefined
    const [hours, minutes] = value.split(":").map(Number)
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined
  }
  const now = toMinutes(localTime)
  const from = toMinutes(start)
  const until = toMinutes(end)
  if (now === undefined || from === undefined || until === undefined) return false
  return from < until ? now >= from && now < until : now >= from || now < until
}

export function getLocalTimeFromOffset(time: Date, timezoneOffsetMinutes: number) {
  const local = new Date(time.getTime() - timezoneOffsetMinutes * 60_000)
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`
}

export function isMeaningfulObservationChange(previous: string | undefined, current: string) {
  if (!previous) return true
  if (/^\s*\[UNCHANGED\]/i.test(current)) return false
  if (/^\s*\[CHANGED\]/i.test(current)) return true
  const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
  const before = words(previous)
  const after = words(current)
  if (!before.size || !after.size) return false
  const shared = [...before].filter((word) => after.has(word)).length
  return shared / Math.max(before.size, after.size) < 0.65
}

function contentTerms(value: string) {
  const ignored = new Set("about after also and are because been before but can could did does for from had has have how into its just more most not our out over she should that the their them then there these they this those was were what when where which who will with would you your".split(" "))
  return new Set((value.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((word) => !ignored.has(word)))
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ")
}

export function parseProactiveDecision(outputText: string) {
  const start = outputText.indexOf("{")
  const end = outputText.lastIndexOf("}")
  if (start < 0 || end <= start) return undefined
  try {
    const parsed: unknown = JSON.parse(outputText.slice(start, end + 1))
    if (!parsed || typeof parsed !== "object") return undefined
    const value = parsed as Record<string, unknown>
    const message = value.message
    const speakMessage = typeof message === "string" ? message.trim() : ""
    if (value.decision !== "speak" && value.decision !== "quiet") return undefined
    if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) return undefined
    if (value.decision === "speak" && (!speakMessage || speakMessage.length > 240)) return undefined
    return {
      decision: value.decision,
      confidence: value.confidence,
      message: speakMessage,
    }
  } catch {
    return undefined
  }
}

export function isGroundedProactiveMessage(message: string, sources: string[]) {
  const messageWords = contentTerms(message)
  const sourceWords = contentTerms(sources.join(" "))
  return [...messageWords].some((word) => sourceWords.has(word))
}

export function isDuplicateProactiveMessage(message: string, previous: string) {
  const first = contentTerms(message)
  const second = contentTerms(previous)
  if (!first.size || !second.size) return false
  const shared = [...first].filter((word) => second.has(word)).length
  return normalize(message) === normalize(previous) || shared / Math.max(first.size, second.size) >= 0.82
}
