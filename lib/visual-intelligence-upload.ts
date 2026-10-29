import "server-only"

import sharp, { type Metadata } from "sharp"
import {
  MAX_VISUAL_IMAGE_BYTES,
  MAX_VISUAL_IMAGE_PIXELS,
  MAX_VISUAL_IMAGE_SIDE,
  VISUAL_IMAGE_TYPES,
  type VisualImageMimeType,
} from "@/lib/visual-intelligence-client"

const MAX_MULTIPART_OVERHEAD = 128 * 1024
const MAX_MULTIPART_BYTES = MAX_VISUAL_IMAGE_BYTES + MAX_MULTIPART_OVERHEAD

export class VisualUploadValidationError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
    this.name = "VisualUploadValidationError"
  }
}

export interface ValidatedVisualImage {
  bytes: Uint8Array
  mimeType: VisualImageMimeType
  width: number
  height: number
}

function acceptedFileType(value: string): value is VisualImageMimeType {
  return VISUAL_IMAGE_TYPES.includes(value as VisualImageMimeType)
}

export async function validateUploadedVisualImage(file: File): Promise<ValidatedVisualImage> {
  if (!acceptedFileType(file.type)) {
    throw new VisualUploadValidationError("Choose a JPEG, PNG, or WebP image.", 415, "unsupported_type")
  }
  if (file.size < 1 || file.size > MAX_VISUAL_IMAGE_BYTES) {
    throw new VisualUploadValidationError("Choose an image no larger than 10 MB.", 413, "file_too_large")
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  let image: Metadata
  try {
    const pipeline = sharp(bytes, { failOn: "error" })
    image = await pipeline.metadata()
    if (image.format !== file.type.slice("image/".length)) {
      throw new VisualUploadValidationError("The image contents do not match the selected file type.", 415, "type_mismatch")
    }
    if (!image.width || !image.height) {
      throw new VisualUploadValidationError("This image has invalid dimensions.", 400, "invalid_dimensions")
    }
    const swapsOrientation = image.orientation !== undefined && image.orientation >= 5 && image.orientation <= 8
    const width = swapsOrientation ? image.height : image.width
    const height = swapsOrientation ? image.width : image.height
    if (width > MAX_VISUAL_IMAGE_SIDE || height > MAX_VISUAL_IMAGE_SIDE
      || width * height > MAX_VISUAL_IMAGE_PIXELS) {
      throw new VisualUploadValidationError("This image is too large in pixel dimensions. Choose a smaller image.", 413, "dimensions_too_large")
    }

    // Decode and re-encode to strip EXIF/GPS metadata before sending the image to the model.
    const safePipeline = sharp(bytes, { limitInputPixels: MAX_VISUAL_IMAGE_PIXELS, failOn: "warning" }).rotate()
    const sanitized = image.format === "jpeg"
      ? await safePipeline.jpeg({ quality: 88 }).toBuffer()
      : image.format === "png"
        ? await safePipeline.png().toBuffer()
        : await safePipeline.webp({ quality: 88 }).toBuffer()
    if (sanitized.byteLength > MAX_VISUAL_IMAGE_BYTES) {
      throw new VisualUploadValidationError("This image is too large after safe processing. Choose a smaller image.", 413, "processed_image_too_large")
    }
    return { bytes: sanitized, mimeType: file.type, width, height }
  } catch (error) {
    if (error instanceof VisualUploadValidationError) throw error
    throw new VisualUploadValidationError("This image appears corrupted or could not be decoded.", 400, "corrupt_image")
  }
}

export interface VisualAnalysisHandlerDependencies {
  getSession: (headers: Headers) => Promise<unknown | null>
  analyzeImage: (image: { bytes: Uint8Array; mimeType: string }, question?: string) => Promise<unknown>
  logError?: (entry: Record<string, unknown>) => void
}

async function readMultipartForm(request: Request): Promise<FormData> {
  const reader = request.body?.getReader()
  if (!reader) throw new VisualUploadValidationError("The upload body is empty.", 400, "empty_upload")
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_MULTIPART_BYTES) {
        await reader.cancel()
        throw new VisualUploadValidationError("Choose an image no larger than 10 MB.", 413, "file_too_large")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Response(body, { headers: { "content-type": request.headers.get("content-type") || "" } }).formData()
}

export function createVisualAnalysisPostHandler(dependencies: VisualAnalysisHandlerDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID()
    try {
      const origin = request.headers.get("origin")
      if (origin && new URL(origin).host !== new URL(request.url).host) {
        return Response.json({ success: false, code: "invalid_origin", message: "This request could not be verified. Refresh Rocky and try again." }, { status: 403 })
      }

      const session = await dependencies.getSession(request.headers)
      if (!session) {
        return Response.json({ success: false, code: "unauthenticated", message: "Sign in to analyze an image." }, { status: 401 })
      }

      const contentType = request.headers.get("content-type") || ""
      if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
        return Response.json({ success: false, code: "invalid_content_type", message: "Send the image as a multipart upload." }, { status: 415 })
      }
      const contentLength = Number(request.headers.get("content-length"))
      if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
        return Response.json({ success: false, code: "file_too_large", message: "Choose an image no larger than 10 MB." }, { status: 413 })
      }

      let form: FormData
      try {
        form = await readMultipartForm(request)
      } catch (error) {
        if (error instanceof VisualUploadValidationError) {
          return Response.json({ success: false, code: error.code, message: error.message }, { status: error.status })
        }
        return Response.json({ success: false, code: "invalid_multipart", message: "The upload could not be read. Try choosing the image again." }, { status: 400 })
      }
      const imageValue = form.get("image")
      if (!imageValue || typeof imageValue === "string" || typeof imageValue.arrayBuffer !== "function") {
        return Response.json({ success: false, code: "missing_image", message: "Choose an image before submitting." }, { status: 400 })
      }
      const file = imageValue as File
      const questionValue = form.get("question")
      const question = typeof questionValue === "string" ? questionValue.trim() : ""
      if (question.length > 2_000) {
        return Response.json({ success: false, code: "question_too_long", message: "Keep your question under 2,000 characters." }, { status: 400 })
      }

      const validated = await validateUploadedVisualImage(file)
      const analysis = await dependencies.analyzeImage(
        { bytes: validated.bytes, mimeType: validated.mimeType },
        question || undefined,
      )
      return Response.json({ success: true, requestId, analysis }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      if (error instanceof VisualUploadValidationError) {
        return Response.json({ success: false, requestId, code: error.code, message: error.message }, { status: error.status })
      }
      const modelError = error as { code?: unknown; status?: unknown; message?: unknown; requestId?: unknown }
      const code = typeof modelError?.code === "string" ? modelError.code : "analysis_failed"
      const status = code === "missing_api_key" || code === "capability_disabled"
        ? 503
        : modelError?.status === 429 || code === "rate_limited"
          ? 429
          : 502
      const message = code === "missing_api_key"
        ? "Visual Intelligence is not configured yet. Ask your Rocky administrator to set MODEL_API_KEY."
        : code === "capability_disabled"
          ? "Image analysis is currently disabled. Ask your Rocky administrator to enable Muse Spark."
          : code === "rate_limited"
            ? "Rocky is receiving too many analysis requests. Wait a moment and retry."
            : "Rocky could not analyze this image. Check your connection and retry."
      dependencies.logError?.({
        event: "visual_intelligence_upload",
        requestId,
        providerRequestId: typeof modelError?.requestId === "string" ? modelError.requestId : undefined,
        code,
        status,
      })
      return Response.json({ success: false, requestId, code, message }, { status, headers: { "Cache-Control": "no-store" } })
    }
  }
}
