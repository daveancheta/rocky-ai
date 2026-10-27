import "server-only"

import {
  isMetaResponseWithinSizeLimit,
  MAX_META_RESPONSE_BYTES,
  validateMuseSparkInput,
  validateMuseSparkResponse,
  type MuseSparkInput,
} from "@/lib/validation/meta"

const META_RESPONSES_ENDPOINT = "https://api.meta.ai/v1/responses"
export const MUSE_SPARK_MODEL = "muse-spark-1.3"

export type MuseSparkRequest = MuseSparkInput

export type MuseSparkResult = {
  id: string
  model: string
  outputText: string
}

export type MuseVoiceTranscription = {
  transcript: string
}

export class MetaModelApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = "MetaModelApiError"
  }
}

async function readMetaResponseText(response: Response): Promise<string> {
  if (!isMetaResponseWithinSizeLimit(response.headers.get("content-length"), 0)) {
    throw new MetaModelApiError("Meta Model API response exceeded the allowed size.", response.status)
  }
  if (!response.body) return ""

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (
        totalBytes > MAX_META_RESPONSE_BYTES ||
        !isMetaResponseWithinSizeLimit(response.headers.get("content-length"), totalBytes)
      ) {
        void reader.cancel().catch(() => undefined)
        throw new MetaModelApiError("Meta Model API response exceeded the allowed size.", response.status)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof MetaModelApiError) throw error
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw error
    }
    throw new MetaModelApiError("Could not read the Meta Model API response.", response.status)
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new MetaModelApiError("Meta Model API returned invalid text encoding.", response.status)
  }
}

export async function generateWithMuseSpark(
  request: unknown,
  options: { signal?: AbortSignal; instructions?: string } = {},
): Promise<MuseSparkResult> {
  const parsedRequest = validateMuseSparkInput(request)
  if (!parsedRequest.success) {
    throw new MetaModelApiError(parsedRequest.error)
  }

  const apiKey = process.env.MODEL_API_KEY
  if (!apiKey) {
    throw new MetaModelApiError("MODEL_API_KEY is not configured on the server.")
  }

  let response: Response
  try {
    response = await fetch(META_RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MUSE_SPARK_MODEL,
        input: parsedRequest.data.input,
        ...(options.instructions
          ? { instructions: options.instructions.slice(0, 4_000) }
          : {}),
      }),
      signal: options.signal,
    })
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw error
    }
    throw new MetaModelApiError("Could not reach the Meta Model API.")
  }

  const responseText = await readMetaResponseText(response)

  let body: unknown
  try {
    body = JSON.parse(responseText)
  } catch {
    throw new MetaModelApiError("Meta Model API returned an invalid response.", response.status)
  }

  if (!response.ok) {
    throw new MetaModelApiError(
      `Meta Model API request failed with status ${response.status}.`,
      response.status,
    )
  }

  const parsedResponse = validateMuseSparkResponse(body)
  if (!parsedResponse.success) {
    throw new MetaModelApiError(parsedResponse.error, response.status)
  }
  if (
    parsedResponse.data.model !== undefined &&
    parsedResponse.data.model !== MUSE_SPARK_MODEL
  ) {
    throw new MetaModelApiError(
      "Meta Model API returned a different model than requested.",
      response.status,
    )
  }

  const outputText = parsedResponse.data.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("")
    .trim()

  if (!outputText) {
    throw new MetaModelApiError("Meta Model API response contained no text output.", response.status)
  }

  return {
    id: parsedResponse.data.id,
    model: parsedResponse.data.model ?? MUSE_SPARK_MODEL,
    outputText,
  }
}

export async function transcribeWithMuseVoice(
  audio: Uint8Array,
  options: { signal?: AbortSignal } = {},
): Promise<MuseVoiceTranscription> {
  const apiKey = process.env.MODEL_API_KEY
  if (!apiKey) {
    throw new MetaModelApiError("MODEL_API_KEY is not configured on the server.")
  }

  const audioBuffer = new ArrayBuffer(audio.byteLength)
  new Uint8Array(audioBuffer).set(audio)
  const formData = new FormData()
  formData.set(
    "request",
    new Blob(
      [
        JSON.stringify({
          model: "muse-voice-transcribe-1.0",
          audioEncoding: "WAV",
          mode: "PUSH_TO_TALK",
        }),
      ],
      { type: "application/json" },
    ),
  )
  formData.set("audio", new Blob([audioBuffer], { type: "audio/wav" }), "recording.wav")

  let response: Response
  try {
    response = await fetch("https://api.meta.ai/v1/asr/transcribe", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      body: formData,
      signal: options.signal,
    })
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw error
    }
    throw new MetaModelApiError("Could not reach the Meta Voice API.")
  }

  const responseText = await readMetaResponseText(response)
  let body: unknown
  try {
    body = JSON.parse(responseText)
  } catch {
    throw new MetaModelApiError("Meta Voice API returned an invalid response.", response.status)
  }

  if (!response.ok) {
    throw new MetaModelApiError(
      `Meta Voice API request failed with status ${response.status}.`,
      response.status,
    )
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("transcript" in body) ||
    typeof body.transcript !== "string" ||
    body.transcript.length > 20_000
  ) {
    throw new MetaModelApiError("Meta Voice API returned an invalid transcript.", response.status)
  }

  return { transcript: body.transcript.trim() }
}
