import "server-only"

import {
  decodeMaskToRaster,
  parseImageStream,
  recordsOfKind,
  type ImageSegmentationResult,
} from "@meta-sam/parser"
import OpenAI, { APIError, toFile } from "openai"
import { randomUUID } from "node:crypto"

const DEFAULT_BASE_URL = "https://api.meta.ai/v1"
const DEFAULT_TIMEOUT_MS = 60_000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_AUDIO_BYTES = 30 * 1024 * 1024
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

type ImageMimeType = (typeof IMAGE_TYPES)[number]
type CapabilityName = "museSpark" | "sam" | "museWonder" | "museImage" | "museVoiceTranscribe"
type CapabilityStatus = "available" | "disabled" | "unavailable" | "error"
type Environment = Record<string, string | undefined>

export interface ImageInput {
  bytes: Uint8Array
  mimeType: string
}

export interface AudioInput {
  bytes: Uint8Array
  fileName?: string
}

export interface VisualAnalysis {
  subject: string
  category: "object" | "animal" | "plant" | "landmark" | "product" | "person" | "other"
  shortDescription: string
  visualDetails: string[]
  confidence: "low" | "medium" | "high"
  followUpSuggestions: string[]
}

export interface ServiceResult<T> {
  requestId: string
  model: string
  result: T
}

export interface CapabilityHealth {
  capability: CapabilityName
  model: string | null
  status: CapabilityStatus
  message?: string
}

export interface MetaHealthResult {
  requestId: string
  checkedAt: string
  capabilities: CapabilityHealth[]
}

export class MetaModelApiError extends Error {
  readonly code: string
  readonly status?: number
  readonly retryAfterMs?: number
  readonly requestId?: string

  constructor(
    message: string,
    options: { code: string; status?: number; retryAfterMs?: number; requestId?: string },
  ) {
    super(message)
    this.name = "MetaModelApiError"
    this.code = options.code
    this.status = options.status
    this.retryAfterMs = options.retryAfterMs
    this.requestId = options.requestId
  }
}

interface MetaModelApiOptions {
  env?: Environment
  fetch?: typeof fetch
  logger?: {
    info: (entry: Record<string, unknown>) => void
    error: (entry: Record<string, unknown>) => void
  }
}

interface CapabilityConfig {
  capability: CapabilityName
  model: string | null
  optional: boolean
}

const visualAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    category: {
      type: "string",
      enum: ["object", "animal", "plant", "landmark", "product", "person", "other"],
    },
    shortDescription: { type: "string" },
    visualDetails: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    followUpSuggestions: { type: "array", items: { type: "string" } },
  },
  required: ["subject", "category", "shortDescription", "visualDetails", "confidence", "followUpSuggestions"],
} as const

function getCapabilityConfigs(env: Environment): CapabilityConfig[] {
  return [
    { capability: "museSpark", model: env.META_MUSE_SPARK_MODEL?.trim() || "muse-spark-1.3", optional: false },
    { capability: "sam", model: env.META_SAM_MODEL?.trim() || "sam-3.1", optional: false },
    { capability: "museWonder", model: env.META_MUSE_WONDER_MODEL?.trim() || null, optional: true },
    { capability: "museImage", model: env.META_MUSE_IMAGE_MODEL?.trim() || null, optional: true },
    { capability: "museVoiceTranscribe", model: env.META_MUSE_VOICE_MODEL?.trim() || null, optional: true },
  ]
}

function isImageMimeType(value: string): value is ImageMimeType {
  return IMAGE_TYPES.includes(value as ImageMimeType)
}

function hasImageSignature(bytes: Uint8Array, mimeType: ImageMimeType): boolean {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  }
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
}

function validateImage(image: ImageInput): ImageMimeType {
  if (!isImageMimeType(image.mimeType)) {
    throw new MetaModelApiError("Use a JPEG, PNG, or WebP image.", { code: "unsupported_image_type" })
  }
  if (image.bytes.byteLength === 0 || image.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new MetaModelApiError("The image must be between 1 byte and 10 MB.", { code: "invalid_image_size" })
  }
  if (!hasImageSignature(image.bytes, image.mimeType)) {
    throw new MetaModelApiError("The image content does not match its file type.", { code: "invalid_image_signature" })
  }
  return image.mimeType
}

function imageDataUrl(image: ImageInput): string {
  const mimeType = validateImage(image)
  return `data:${mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`
}

function assertPrompt(prompt: string, label: string, maxLength: number): string {
  const value = prompt.trim()
  if (!value || value.length > maxLength) {
    throw new MetaModelApiError(`${label} must be between 1 and ${maxLength} characters.`, { code: "invalid_prompt" })
  }
  return value
}

function parseVisualAnalysis(value: string): VisualAnalysis {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new MetaModelApiError("Meta returned malformed structured analysis.", { code: "malformed_response" })
  }

  if (!parsed || typeof parsed !== "object") {
    throw new MetaModelApiError("Meta returned malformed structured analysis.", { code: "malformed_response" })
  }

  const record = parsed as Record<string, unknown>
  const categories = ["object", "animal", "plant", "landmark", "product", "person", "other"]
  const confidenceLevels = ["low", "medium", "high"]
  if (
    typeof record.subject !== "string"
    || !categories.includes(String(record.category))
    || typeof record.shortDescription !== "string"
    || !Array.isArray(record.visualDetails)
    || !record.visualDetails.every((item) => typeof item === "string")
    || !confidenceLevels.includes(String(record.confidence))
    || !Array.isArray(record.followUpSuggestions)
    || !record.followUpSuggestions.every((item) => typeof item === "string")
  ) {
    throw new MetaModelApiError("Meta returned structured analysis in an unexpected shape.", { code: "malformed_response" })
  }

  return record as unknown as VisualAnalysis
}

function retryDelay(headers: Headers | undefined): number | undefined {
  const value = headers?.get("retry-after")
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined
}

function mapApiError(error: unknown, requestId: string): MetaModelApiError {
  if (error instanceof MetaModelApiError) {
    return new MetaModelApiError(error.message, {
      code: error.code,
      status: error.status,
      retryAfterMs: error.retryAfterMs,
      requestId,
    })
  }

  if (error instanceof APIError) {
    const status = error.status
    const code = status === 429
      ? "rate_limited"
      : status === 401
        ? "unauthorized"
        : status === 403
          ? "forbidden"
          : status === 408
            ? "timeout"
            : status !== undefined && status >= 500
              ? "provider_error"
              : "request_failed"
    const message = status === 429
      ? "Meta Model API rate limit reached. Try again later."
      : status === 401 || status === 403
        ? "Meta Model API rejected the configured credentials or model access."
        : status === 408
          ? "Meta Model API request timed out."
          : "Meta Model API request failed."
    return new MetaModelApiError(message, { code, status, retryAfterMs: retryDelay(error.headers), requestId })
  }

  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" || error.name === "APIConnectionTimeoutError")) {
    return new MetaModelApiError("Meta Model API request timed out.", { code: "timeout", requestId })
  }

  return new MetaModelApiError("Could not connect to Meta Model API.", { code: "connection_error", requestId })
}

function validateAudio(audio: AudioInput): Buffer {
  if (audio.bytes.byteLength === 0 || audio.bytes.byteLength > MAX_AUDIO_BYTES) {
    throw new MetaModelApiError("The WAV audio must be smaller than 30 MB.", { code: "invalid_audio_size" })
  }
  const bytes = Buffer.from(audio.bytes)
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new MetaModelApiError("Muse Voice Transcribe requires a WAV file.", { code: "unsupported_audio_type" })
  }
  return bytes
}

function createMetaModelApi(options: MetaModelApiOptions = {}) {
  const env = options.env ?? process.env
  const log = options.logger ?? {
    info: (entry: Record<string, unknown>) => console.info(JSON.stringify(entry)),
    error: (entry: Record<string, unknown>) => console.error(JSON.stringify(entry)),
  }
  const baseURL = (env.MODEL_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "")
  const timeout = Number(env.MODEL_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  const configByCapability = new Map(getCapabilityConfigs(env).map((config) => [config.capability, config]))

  function getClient(requestId: string): OpenAI {
    const apiKey = env.MODEL_API_KEY?.trim()
    if (!apiKey) {
      throw new MetaModelApiError("MODEL_API_KEY is not configured on the server.", {
        code: "missing_api_key",
        requestId,
      })
    }
    return new OpenAI({
      baseURL,
      apiKey,
      timeout,
      maxRetries: 0,
      fetch: options.fetch,
    })
  }

  function getModel(capability: CapabilityName, requestId: string): string {
    const config = configByCapability.get(capability)
    if (!config?.model) {
      throw new MetaModelApiError(`${capability} is not enabled. Set its model ID environment variable to enable it.`, {
        code: "capability_disabled",
        requestId,
      })
    }
    return config.model
  }

  async function run<T>(
    capability: CapabilityName | "modelCatalog",
    model: string,
    operation: (requestId: string) => Promise<T>,
  ): Promise<ServiceResult<T>> {
    const requestId = randomUUID()
    const startedAt = Date.now()
    try {
      const result = await operation(requestId)
      log.info({
        event: "meta_model_request",
        requestId,
        capability,
        model,
        status: "success",
        durationMs: Date.now() - startedAt,
      })
      return { requestId, model, result }
    } catch (error) {
      const safeError = mapApiError(error, requestId)
      log.error({
        event: "meta_model_request",
        requestId,
        capability,
        model,
        status: "error",
        code: safeError.code,
        httpStatus: safeError.status,
        retryAfterMs: safeError.retryAfterMs,
        durationMs: Date.now() - startedAt,
      })
      throw safeError
    }
  }

  async function analyzeImage(image: ImageInput, question?: string): Promise<ServiceResult<VisualAnalysis & { responseId: string }>> {
    const requestId = randomUUID()
    const model = getModel("museSpark", requestId)
    const dataUrl = imageDataUrl(image)
    const prompt = question ? assertPrompt(question, "Question", 2_000) : "Describe and analyze the main subject in this image."

    return run("museSpark", model, async (id) => {
      const response = await getClient(id).responses.create({
        model,
        store: false,
        instructions: "Analyze visual content only. Do not identify a person or infer sensitive personal traits. Be concise, distinguish visible evidence from uncertain guesses, and return the requested structured result.",
        input: [{
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: `${prompt}\nReturn category, a brief description, visible details, confidence, and useful follow-up questions.` },
            { type: "input_image", image_url: dataUrl, detail: "auto" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "visual_analysis",
            strict: true,
            schema: visualAnalysisSchema,
          },
        },
      }, { timeout, maxRetries: 0 })

      if (response.status !== "completed" || !response.id || !response.output_text) {
        throw new MetaModelApiError("Meta returned an incomplete image analysis.", { code: "malformed_response" })
      }
      return { ...parseVisualAnalysis(response.output_text), responseId: response.id }
    })
  }

  async function askMuseSparkFollowUp(
    image: ImageInput,
    previousAnalysis: VisualAnalysis,
    question: string,
  ): Promise<ServiceResult<{ responseId: string; answer: string }>> {
    const requestId = randomUUID()
    const model = getModel("museSpark", requestId)
    const dataUrl = imageDataUrl(image)
    const followUp = assertPrompt(question, "Question", 2_000)

    return run("museSpark", model, async (id) => {
      const response = await getClient(id).responses.create({
        model,
        store: false,
        instructions: "Answer follow-up questions using the provided image and analysis. Do not identify a person or infer sensitive personal traits. If the image does not support an answer, say so.",
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: "Analyze this image." },
              { type: "input_image", image_url: dataUrl, detail: "auto" },
            ],
          },
          { type: "message", role: "assistant", content: JSON.stringify(previousAnalysis) },
          { type: "message", role: "user", content: [{ type: "input_text", text: followUp }] },
        ],
      }, { timeout, maxRetries: 0 })

      if (response.status !== "completed" || !response.id || !response.output_text?.trim()) {
        throw new MetaModelApiError("Meta returned an incomplete follow-up response.", { code: "malformed_response" })
      }
      return { responseId: response.id, answer: response.output_text.trim() }
    })
  }

  async function segmentImage(image: ImageInput, objectPrompt: string): Promise<ServiceResult<ImageSegmentationResult>> {
    const requestId = randomUUID()
    const model = getModel("sam", requestId)
    const dataUrl = imageDataUrl(image)
    const prompt = assertPrompt(objectPrompt, "Object prompt", 120)

    return run("sam", model, async (id) => {
      const events = await getClient(id).responses.create({
        model,
        stream: true,
        store: false,
        metadata: { mask_encoding: "one_bit" },
        input: [{
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: dataUrl, detail: "auto" },
          ],
        }],
      }, { timeout, maxRetries: 0 })
      const parsed = await parseImageStream(events).finalResult
      if (parsed.outcome.status !== "completed" || parsed.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        throw new MetaModelApiError("Meta returned malformed or incomplete SAM segmentation output.", { code: "malformed_response" })
      }
      return parsed
    })
  }

  async function researchWithMuseWonder(query: string): Promise<ServiceResult<{
    answer: string
    searched: boolean
    sources: Array<{ title: string; url: string }>
  }>> {
    const requestId = randomUUID()
    const model = getModel("museWonder", requestId)
    const prompt = assertPrompt(query, "Research query", 4_000)

    return run("museWonder", model, async (id) => {
      const response = await getClient(id).responses.create({
        model,
        store: false,
        instructions: "Research the request using live web sources when useful. Cite factual claims and do not present unsupported claims as verified.",
        input: prompt,
        tools: [{ type: "web_search" }],
        include: ["web_search_call.results"],
      }, { timeout, maxRetries: 0 })

      if (response.status !== "completed" || !response.output_text?.trim()) {
        throw new MetaModelApiError("Meta returned an incomplete research response.", { code: "malformed_response" })
      }
      const sources = new Map<string, { title: string; url: string }>()
      for (const item of response.output) {
        if (item.type !== "message") continue
        for (const block of item.content) {
          if (block.type !== "output_text") continue
          for (const annotation of block.annotations) {
            if (annotation.type !== "url_citation") continue
            try {
              const url = new URL(annotation.url)
              if (url.protocol === "https:" || url.protocol === "http:") {
                sources.set(url.href, { title: annotation.title || url.hostname, url: url.href })
              }
            } catch {
              // Ignore invalid citation URLs in provider output.
            }
          }
        }
      }
      return {
        answer: response.output_text.trim(),
        searched: response.output.some((item) => item.type === "web_search_call"),
        sources: [...sources.values()],
      }
    })
  }

  async function generateMuseImage(prompt: string): Promise<ServiceResult<{
    b64Json?: string
    url?: string
    revisedPrompt?: string
  }>> {
    const requestId = randomUUID()
    const model = getModel("museImage", requestId)
    const description = assertPrompt(prompt, "Image prompt", 4_000)

    return run("museImage", model, async (id) => {
      const response = await getClient(id).images.generate({
        model,
        prompt: description,
        n: 1,
        stream: false,
        response_format: "b64_json",
      }, { timeout, maxRetries: 0 })
      const image = response.data?.[0]
      if (!image?.b64_json && !image?.url) {
        throw new MetaModelApiError("Meta returned no generated image.", { code: "malformed_response" })
      }
      return { b64Json: image.b64_json, url: image.url, revisedPrompt: image.revised_prompt }
    })
  }

  async function editMuseImage(image: ImageInput, prompt: string): Promise<ServiceResult<{
    b64Json?: string
    url?: string
    revisedPrompt?: string
  }>> {
    const requestId = randomUUID()
    const model = getModel("museImage", requestId)
    const description = assertPrompt(prompt, "Image edit instruction", 4_000)
    validateImage(image)

    return run("museImage", model, async (id) => {
      const file = await toFile(Buffer.from(image.bytes), `reference.${image.mimeType === "image/jpeg" ? "jpg" : image.mimeType.split("/")[1]}`, {
        type: image.mimeType,
      })
      const response = await getClient(id).images.edit({
        model,
        prompt: description,
        image: file,
        n: 1,
        stream: false,
        response_format: "b64_json",
      }, { timeout, maxRetries: 0 })
      const output = response.data?.[0]
      if (!output?.b64_json && !output?.url) {
        throw new MetaModelApiError("Meta returned no edited image.", { code: "malformed_response" })
      }
      return { b64Json: output.b64_json, url: output.url, revisedPrompt: output.revised_prompt }
    })
  }

  async function transcribeMuseVoice(audio: AudioInput): Promise<ServiceResult<{
    transcript: string
    audioDurationMs?: number
    turns: Array<{ turnId: number; startMs: number; endMs: number; transcript: string; speaker?: string }>
    sessionId: string
  }>> {
    const requestId = randomUUID()
    const model = getModel("museVoiceTranscribe", requestId)
    const bytes = validateAudio(audio)

    return run("museVoiceTranscribe", model, async (id) => {
      const apiKey = env.MODEL_API_KEY?.trim()
      if (!apiKey) {
        throw new MetaModelApiError("MODEL_API_KEY is not configured on the server.", { code: "missing_api_key" })
      }

      const form = new FormData()
      form.append("request", new Blob([JSON.stringify({ model, audioEncoding: "WAV", mode: "PUSH_TO_TALK" })], {
        type: "application/json",
      }))
      form.append("audio", new Blob([Uint8Array.from(bytes).buffer], { type: "audio/wav" }), audio.fileName || "recording.wav")
      const url = new URL(`${baseURL}/asr/transcribe`)
      url.searchParams.set("sessionId", id)
      const response = await (options.fetch ?? fetch)(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        body: form,
        signal: AbortSignal.timeout(timeout),
      })

      if (!response.ok) {
        const retryAfterMs = retryDelay(response.headers)
        const code = response.status === 429
          ? "rate_limited"
          : response.status === 401
            ? "unauthorized"
            : response.status === 403
              ? "forbidden"
              : response.status === 408 || response.status === 504
                ? "timeout"
                : response.status >= 500
                  ? "provider_error"
                  : "request_failed"
        throw new MetaModelApiError(
          response.status === 429
            ? "Meta Voice Transcribe rate limit reached. Try again later."
            : response.status === 401 || response.status === 403
              ? "Meta Model API rejected the configured credentials or model access."
              : code === "timeout"
                ? "Meta Model API request timed out."
                : "Meta Voice Transcribe request failed.",
          { code, status: response.status, retryAfterMs },
        )
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new MetaModelApiError("Meta returned malformed transcription output.", { code: "malformed_response" })
      }
      if (!payload || typeof payload !== "object") {
        throw new MetaModelApiError("Meta returned malformed transcription output.", { code: "malformed_response" })
      }
      const record = payload as Record<string, unknown>
      if (typeof record.transcript !== "string" || typeof record.sessionId !== "string") {
        throw new MetaModelApiError("Meta returned malformed transcription output.", { code: "malformed_response" })
      }
      const turns = Array.isArray(record.turns) ? record.turns.filter((turn): turn is Record<string, unknown> => {
        return Boolean(turn && typeof turn === "object")
          && typeof (turn as Record<string, unknown>).turnId === "number"
          && typeof (turn as Record<string, unknown>).startMs === "number"
          && typeof (turn as Record<string, unknown>).endMs === "number"
          && typeof (turn as Record<string, unknown>).transcript === "string"
      }).map((turn) => ({
        turnId: turn.turnId as number,
        startMs: turn.startMs as number,
        endMs: turn.endMs as number,
        transcript: turn.transcript as string,
        speaker: typeof turn.speaker === "string" ? turn.speaker : undefined,
      })) : []
      return {
        transcript: record.transcript,
        audioDurationMs: typeof record.audioDurationMs === "number" ? record.audioDurationMs : undefined,
        turns,
        sessionId: record.sessionId,
      }
    })
  }

  async function checkCapabilities(): Promise<MetaHealthResult> {
    const requestId = randomUUID()
    const configs = getCapabilityConfigs(env)
    const keyPresent = Boolean(env.MODEL_API_KEY?.trim())
    const configured = configs.filter((item) => item.model)
    const base = configs.map((item): CapabilityHealth => {
      if (!item.model && item.optional) {
        return { capability: item.capability, model: null, status: "disabled", message: "No optional model ID configured." }
      }
      if (!keyPresent) {
        return { capability: item.capability, model: item.model, status: "unavailable", message: "MODEL_API_KEY is not configured." }
      }
      return { capability: item.capability, model: item.model, status: "error", message: "Model catalog check did not complete." }
    })

    if (!keyPresent || configured.length === 0) {
      return { requestId, checkedAt: new Date().toISOString(), capabilities: base }
    }

    const startedAt = Date.now()
    try {
      const models = await getClient(requestId).models.list({ timeout, maxRetries: 0 })
      const availableModels = new Set<string>()
      for await (const model of models) availableModels.add(model.id)
      const capabilities = base.map((item) => {
        if (!item.model) return item
        return availableModels.has(item.model)
          ? { capability: item.capability, model: item.model, status: "available" as const }
          : { capability: item.capability, model: item.model, status: "unavailable" as const, message: "This model ID is not listed for the configured account." }
      })
      log.info({ event: "meta_model_health", requestId, status: "success", configuredModelCount: configured.length, durationMs: Date.now() - startedAt })
      return { requestId, checkedAt: new Date().toISOString(), capabilities }
    } catch (error) {
      const safeError = mapApiError(error, requestId)
      log.error({
        event: "meta_model_health",
        requestId,
        status: "error",
        code: safeError.code,
        httpStatus: safeError.status,
        durationMs: Date.now() - startedAt,
      })
      const capabilities = base.map((item) => item.model
        ? { capability: item.capability, model: item.model, status: "error" as const, message: safeError.message }
        : item)
      return { requestId, checkedAt: new Date().toISOString(), capabilities }
    }
  }

  return {
    analyzeImage,
    askMuseSparkFollowUp,
    segmentImage,
    researchWithMuseWonder,
    generateMuseImage,
    editMuseImage,
    transcribeMuseVoice,
    checkCapabilities,
    decodeMaskToRaster,
    recordsOfKind,
  }
}

const metaModelApi = createMetaModelApi()

export const analyzeImage = metaModelApi.analyzeImage
export const askMuseSparkFollowUp = metaModelApi.askMuseSparkFollowUp
export const segmentImage = metaModelApi.segmentImage
export const researchWithMuseWonder = metaModelApi.researchWithMuseWonder
export const generateMuseImage = metaModelApi.generateMuseImage
export const editMuseImage = metaModelApi.editMuseImage
export const transcribeMuseVoice = metaModelApi.transcribeMuseVoice
export const checkMetaModelCapabilities = metaModelApi.checkCapabilities
export { decodeMaskToRaster, recordsOfKind }
export type { ImageSegmentationResult }

export const metaModelApiTesting = { createMetaModelApi }
