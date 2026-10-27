export type MuseSparkInput = {
  input: string
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

const MAX_INPUT_LENGTH = 20_000
const MAX_INPUT_BYTES = 64 * 1024
export const MAX_META_RESPONSE_BYTES = 2 * 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function validateMuseSparkInput(
  value: unknown,
): ValidationResult<MuseSparkInput> {
  if (!isRecord(value) || typeof value.input !== "string") {
    return { success: false, error: "Input must be an object with a string input field." }
  }

  const input = value.input.trim()
  if (!input) {
    return { success: false, error: "Input must not be empty." }
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return { success: false, error: `Input must not exceed ${MAX_INPUT_LENGTH} characters.` }
  }
  if (new TextEncoder().encode(input).byteLength > MAX_INPUT_BYTES) {
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

export function validateMetaApiError(
  value: unknown,
): { message: string } | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined
  return typeof value.error.message === "string"
    ? { message: value.error.message }
    : undefined
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
