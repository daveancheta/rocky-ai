export type MuseSparkTurn = {
  role: "user" | "assistant"
  content: Array<{
    type: "input_text" | "output_text"
    text: string
  }>
}

export type MuseSparkInput = {
  input: MuseSparkTurn[]
}

export type MuseSparkOutputText = {
  id: string
  model?: string
  output: Array<{
    type: string
    content?: Array<{
      type: string
      text?: string
    }>
  }>
}

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const MAX_INPUT_LENGTH = 32_000
const MAX_INPUT_BYTES = 64 * 1024
export const MAX_META_RESPONSE_BYTES = 2 * 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function validateMuseSparkInput(
  value: unknown,
): ValidationResult<MuseSparkInput> {
  if (!isRecord(value) || !Array.isArray(value.input) || value.input.length === 0) {
    return { success: false, error: "Input must contain at least one conversation turn." }
  }

  const input: MuseSparkTurn[] = []
  let totalLength = 0
  for (const turn of value.input) {
    if (
      !isRecord(turn) ||
      (turn.role !== "user" && turn.role !== "assistant") ||
      !Array.isArray(turn.content) ||
      turn.content.length !== 1
    ) {
      return { success: false, error: "Input contains an invalid conversation turn." }
    }

    const [part] = turn.content
    const contentType = turn.role === "user" ? "input_text" : "output_text"
    if (
      !isRecord(part) ||
      part.type !== contentType ||
      typeof part.text !== "string" ||
      !part.text.trim()
    ) {
      return { success: false, error: "Input contains invalid conversation content." }
    }
    totalLength += part.text.length
    if (totalLength > MAX_INPUT_LENGTH) {
      return { success: false, error: `Input must not exceed ${MAX_INPUT_LENGTH} characters.` }
    }
    input.push({
      role: turn.role,
      content: [{ type: contentType, text: part.text }],
    })
  }

  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > MAX_INPUT_BYTES) {
    return { success: false, error: `Input must not exceed ${MAX_INPUT_BYTES} bytes.` }
  }

  return { success: true, data: { input } }
}

export function validateMuseSparkResponse(
  value: unknown,
): ValidationResult<MuseSparkOutputText> {
  if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.output)) {
    return { success: false, error: "Meta Model API response has an invalid shape." }
  }
  if (value.model !== undefined && typeof value.model !== "string") {
    return { success: false, error: "Meta Model API response contains an invalid model name." }
  }

  const output: MuseSparkOutputText["output"] = []
  for (const item of value.output) {
    if (!isRecord(item) || typeof item.type !== "string") {
      return { success: false, error: "Meta Model API response contains an invalid output item." }
    }

    if (item.content === undefined) {
      output.push({ type: item.type })
      continue
    }
    if (!Array.isArray(item.content)) {
      return { success: false, error: "Meta Model API response contains invalid output content." }
    }

    const content: NonNullable<MuseSparkOutputText["output"][number]["content"]> = []
    for (const part of item.content) {
      if (!isRecord(part) || typeof part.type !== "string") {
        return { success: false, error: "Meta Model API response contains an invalid content item." }
      }
      if (part.text !== undefined && typeof part.text !== "string") {
        return { success: false, error: "Meta Model API response contains invalid text output." }
      }
      content.push({
        type: part.type,
        ...(typeof part.text === "string" ? { text: part.text } : {}),
      })
    }
    output.push({ type: item.type, content })
  }

  return {
    success: true,
    data: {
      id: value.id,
      ...(typeof value.model === "string" ? { model: value.model } : {}),
      output,
    },
  }
}

export function isMetaResponseWithinSizeLimit(
  contentLength: string | null,
  actualBytes: number,
): boolean {
  if (
    !Number.isSafeInteger(actualBytes) ||
    actualBytes < 0 ||
    actualBytes > MAX_META_RESPONSE_BYTES
  ) {
    return false
  }
  if (contentLength === null) return true

  const parsedLength = Number(contentLength)
  return Number.isSafeInteger(parsedLength) &&
    parsedLength >= 0 &&
    parsedLength <= MAX_META_RESPONSE_BYTES &&
    actualBytes <= MAX_META_RESPONSE_BYTES
}
