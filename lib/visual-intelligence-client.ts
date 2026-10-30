export const MAX_VISUAL_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VISUAL_IMAGE_SIDE = 10_000
export const MAX_VISUAL_IMAGE_PIXELS = 25_000_000

export const VISUAL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export type VisualImageMimeType = (typeof VISUAL_IMAGE_TYPES)[number]

export interface ImageDimensions {
  width: number
  height: number
}

export interface VisualAnalysisResponse {
  requestId: string
  model: string
  imageWidth: number
  imageHeight: number
  result: {
    title: string
    category: "object" | "animal" | "plant" | "landmark" | "product" | "person" | "other"
    identification: string
    identificationConfidence: "low" | "medium" | "high"
    shortDescription: string
    visualObservations: string[]
    distinguishingFeatures: string[]
    contextNotes: Array<{
      text: string
      evidence: "visual_observation" | "general_context" | "requires_external_verification"
    }>
    uncertainty: string
    alternatives: string[]
    actionableFindings?: Array<{
      kind: "issue" | "improvement"
      observation: string
      suggestion: string
      confidence: "low" | "medium" | "high"
    }>
    objects: Array<{
      id: string
      label: string
      category: "object" | "animal" | "plant" | "landmark" | "product" | "person" | "other"
      confidence: "low" | "medium" | "high"
      bbox: { xMin: number; yMin: number; xMax: number; yMax: number } | null
    }>
    followUpSuggestions: string[]
  }
}

export interface VisualSegmentationResponse {
  requestId: string
  model: string
  analysisRequestId: string
  objectId: string
  imageWidth: number
  imageHeight: number
  mask: {
    width: number
    height: number
    bounds: { left: number; top: number; right: number; bottom: number }
    dataBase64: string
  }
}

export interface VisualObjectExplanationResponse {
  requestId: string
  model: string
  analysisRequestId: string
  objectId: string
  answer: string
}

export interface PublicInformationResponse {
  requestId: string
  model: string
  result: {
    status: "results" | "no_results" | "ambiguous" | "unavailable"
    title: string
    summary: string
    searched: boolean
    retrievedAt: string
    clarificationQuestion?: string
    sources: Array<{
      title: string
      publisher: string
      url: string
      snippet?: string
      citationStatus: "cited_in_summary" | "search_result_only"
      retrievedAt: string
    }>
  }
}

export class VisualImageValidationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = "VisualImageValidationError"
  }
}

type ImageDecoder = (file: File) => Promise<ImageDimensions>

function browserDecodeImage(file: File): Promise<ImageDimensions> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).then((image) => {
      const dimensions = { width: image.width, height: image.height }
      image.close()
      return dimensions
    })
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new VisualImageValidationError("This image could not be opened. Try another file.", "corrupt_image"))
    }
    image.src = objectUrl
  })
}

export async function validateVisualImageFile(file: File, decode: ImageDecoder = browserDecodeImage): Promise<ImageDimensions> {
  if (!VISUAL_IMAGE_TYPES.includes(file.type as VisualImageMimeType)) {
    throw new VisualImageValidationError("Choose a JPEG, PNG, or WebP image.", "unsupported_type")
  }
  if (file.size < 1 || file.size > MAX_VISUAL_IMAGE_BYTES) {
    throw new VisualImageValidationError("Choose an image no larger than 10 MB.", "file_too_large")
  }

  let dimensions: ImageDimensions
  try {
    dimensions = await decode(file)
  } catch (error) {
    if (error instanceof VisualImageValidationError) throw error
    throw new VisualImageValidationError("This image appears corrupted or could not be opened.", "corrupt_image")
  }

  if (!Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
    throw new VisualImageValidationError("This image has invalid dimensions.", "invalid_dimensions")
  }
  if (dimensions.width > MAX_VISUAL_IMAGE_SIDE || dimensions.height > MAX_VISUAL_IMAGE_SIDE
    || dimensions.width * dimensions.height > MAX_VISUAL_IMAGE_PIXELS) {
    throw new VisualImageValidationError("This image is too large in pixel dimensions. Choose a smaller image.", "dimensions_too_large")
  }
  return dimensions
}

export function cameraAccessErrorMessage(error: unknown): string {
  if (error instanceof Error && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "Camera access was blocked. Allow camera access in your browser settings, or choose an image to upload instead."
  }
  if (error instanceof Error && error.name === "NotFoundError") {
    return "No camera was found. Choose an image to upload instead."
  }
  if (error instanceof Error && error.name === "NotReadableError") {
    return "The camera is busy in another app. Close that app and try again."
  }
  return "The camera could not be started. You can choose an image to upload instead."
}

export async function requestVisualCamera(getUserMedia: () => Promise<MediaStream>): Promise<MediaStream> {
  try {
    return await getUserMedia()
  } catch (error) {
    throw new Error(cameraAccessErrorMessage(error))
  }
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export interface VisualUploadPayload {
  success: true
  analysis: VisualAnalysisResponse
}

export class VisualUploadError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message)
    this.name = "VisualUploadError"
  }
}

export async function searchVisualPublicInformation(input: {
  category: string
  subject: string
  personName?: string
  focus?: string
}): Promise<PublicInformationResponse> {
  let response: Response
  try {
    response = await fetch("/api/visual-intelligence/public-information", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    throw new VisualUploadError("Rocky could not reach public information search. Check your connection and retry.", 0, "network_error")
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new VisualUploadError("Rocky returned an unreadable search response. Try again.", response.status, "invalid_response")
  }
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  if (!response.ok) {
    throw new VisualUploadError(
      typeof record.message === "string" ? record.message : "Public information search is unavailable. Try again.",
      response.status,
      typeof record.code === "string" ? record.code : undefined,
    )
  }
  const result = record.result as Record<string, unknown> | undefined
  const statuses = ["results", "no_results", "ambiguous", "unavailable"]
  if (record.success !== true || typeof record.requestId !== "string" || typeof record.model !== "string"
    || !result || !statuses.includes(String(result.status)) || typeof result.title !== "string"
    || typeof result.summary !== "string" || typeof result.searched !== "boolean"
    || typeof result.retrievedAt !== "string" || !Array.isArray(result.sources)) {
    throw new VisualUploadError("Rocky returned incomplete public information. Try again.", response.status, "invalid_response")
  }
  const sources = result.sources.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const source = value as Record<string, unknown>
    if (typeof source.title !== "string" || typeof source.publisher !== "string"
      || typeof source.url !== "string" || typeof source.retrievedAt !== "string"
      || (source.citationStatus !== "cited_in_summary" && source.citationStatus !== "search_result_only")) return []
    try {
      const url = new URL(source.url)
      if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return []
      url.hash = ""
      return [{
        title: source.title,
        publisher: source.publisher,
        url: url.href,
        ...(typeof source.snippet === "string" ? { snippet: source.snippet.slice(0, 500) } : {}),
        citationStatus: source.citationStatus as "cited_in_summary" | "search_result_only",
        retrievedAt: source.retrievedAt,
      }]
    } catch {
      return []
    }
  })
  return {
    requestId: record.requestId,
    model: record.model,
    result: {
      status: result.status as PublicInformationResponse["result"]["status"],
      title: result.title,
      summary: result.summary,
      searched: result.searched,
      retrievedAt: result.retrievedAt,
      ...(typeof result.clarificationQuestion === "string" ? { clarificationQuestion: result.clarificationQuestion } : {}),
      sources,
    },
  }
}

type XhrFactory = () => XMLHttpRequest

export function uploadVisualAction<T extends { success: true }>(
  endpoint: string,
  file: File,
  fields: Record<string, string>,
  onProgress: (progress: UploadProgress) => void,
  createXhr: XhrFactory = () => new XMLHttpRequest(),
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = createXhr()
    const form = new FormData()
    form.append("image", file, file.name || "image")
    for (const [name, value] of Object.entries(fields)) {
      if (value) form.append(name, value)
    }

    xhr.open("POST", endpoint)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      })
    }
    xhr.onerror = () => reject(new VisualUploadError("The upload could not reach Rocky. Check your connection and try again.", 0, "network_error"))
    xhr.onabort = () => reject(new VisualUploadError("The upload was canceled. You can try again.", 0, "upload_aborted"))
    xhr.onload = () => {
      let payload: unknown
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        reject(new VisualUploadError("Rocky returned an unreadable response. Try again.", xhr.status, "invalid_response"))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
        reject(new VisualUploadError(
          typeof record.message === "string" ? record.message : "Rocky could not analyze this image. Try again.",
          xhr.status,
          typeof record.code === "string" ? record.code : undefined,
        ))
        return
      }
      if (!payload || typeof payload !== "object" || !("success" in payload) || !(payload as { success?: unknown }).success) {
        reject(new VisualUploadError("Rocky returned an incomplete analysis. Try again.", xhr.status, "invalid_response"))
        return
      }
      resolve(payload as T)
    }
    xhr.send(form)
  })
}

export function uploadVisualImage(
  file: File,
  question: string,
  onProgress: (progress: UploadProgress) => void,
  createXhr: XhrFactory = () => new XMLHttpRequest(),
): Promise<VisualUploadPayload> {
  return uploadVisualAction<VisualUploadPayload>(
    "/api/visual-intelligence/analyze",
    file,
    { question: question.trim() },
    onProgress,
    createXhr,
  )
}
