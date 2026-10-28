import { connection } from "next/server"
import { analyzeImageWithMeta, MetaModelApiError } from "@/lib/ai/meta-provider"
import { MAX_VISION_IMAGE_BYTES, validateVisionImage } from "@/lib/validation/image"

const MAX_MULTIPART_BYTES = MAX_VISION_IMAGE_BYTES + 32 * 1024
const MAX_UNDERSTANDING_PROMPT_CHARS = 8_000
const MAX_SEGMENTATION_PROMPT_CHARS = 120

type BoundedBodyResult =
  | { success: true; bytes: Uint8Array }
  | { success: false; response: Response }

async function readBoundedBody(request: Request): Promise<BoundedBodyResult> {
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    const length = Number(contentLength)
    if (!Number.isSafeInteger(length) || length < 0) {
      return {
        success: false,
        response: Response.json({ error: "Invalid request size." }, { status: 400 }),
      }
    }
    if (length > MAX_MULTIPART_BYTES) {
      return {
        success: false,
        response: Response.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 }),
      }
    }
  }
  if (!request.body) {
    return {
      success: false,
      response: Response.json({ error: "An image is required." }, { status: 400 }),
    }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_MULTIPART_BYTES) {
        void reader.cancel().catch(() => undefined)
        return {
          success: false,
          response: Response.json(
            { error: "Choose an image smaller than 5 MB." },
            { status: 413 },
          ),
        }
      }
      chunks.push(value)
    }
  } catch {
    return {
      success: false,
      response: Response.json({ error: "Could not read the image upload." }, { status: 400 }),
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { success: true, bytes }
}

function providerErrorResponse(error: MetaModelApiError) {
  if (!error.status) {
    const missingKey = error.message.includes("MODEL_API_KEY")
    return Response.json(
      {
        error: missingKey
          ? "Image analysis is not configured on the server."
          : "Meta image analysis could not be reached. Please try again.",
      },
      { status: missingKey ? 503 : 502 },
    )
  }
  if (error.status === 401) {
    return Response.json({ error: "Meta image analysis could not authenticate." }, { status: 502 })
  }
  if (error.status === 403 || error.status === 404) {
    return Response.json(
      { error: "This Meta API account cannot use the selected vision model." },
      { status: 503 },
    )
  }
  if (error.status === 429) {
    return Response.json(
      { error: "Meta image analysis is busy. Please try again shortly." },
      { status: 503 },
    )
  }
  return Response.json(
    { error: "Meta image analysis could not complete the request. Please try again." },
    { status: 502 },
  )
}

export async function POST(request: Request) {
  await connection()

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return Response.json({ error: "Send the image as multipart form data." }, { status: 400 })
  }

  const boundedBody = await readBoundedBody(request)
  if (!boundedBody.success) return boundedBody.response

  let formData: FormData
  try {
    const body = new ArrayBuffer(boundedBody.bytes.byteLength)
    new Uint8Array(body).set(boundedBody.bytes)
    formData = await new Response(body, {
      headers: { "content-type": contentType },
    }).formData()
  } catch {
    return Response.json({ error: "The image upload is malformed." }, { status: 400 })
  }

  const imageParts = formData.getAll("image")
  const taskParts = formData.getAll("task")
  const promptParts = formData.getAll("prompt")
  const image = imageParts[0]
  const task = taskParts[0]
  const prompt = promptParts[0]
  if (
    imageParts.length !== 1 ||
    taskParts.length !== 1 ||
    promptParts.length !== 1 ||
    !(image instanceof File) ||
    typeof task !== "string" ||
    typeof prompt !== "string"
  ) {
    return Response.json({ error: "Provide one image, a task, and a prompt." }, { status: 400 })
  }
  if (task !== "understanding" && task !== "segmentation") {
    return Response.json({ error: "Choose a supported image-analysis task." }, { status: 400 })
  }
  const trimmedPrompt = prompt.trim()
  const segmentationPromptIsInvalid =
    task === "segmentation" &&
    (/[.!?\r\n]/.test(trimmedPrompt) || trimmedPrompt.split(/\s+/).length > 12)
  const maxPromptLength = task === "segmentation"
    ? MAX_SEGMENTATION_PROMPT_CHARS
    : MAX_UNDERSTANDING_PROMPT_CHARS
  if (
    !trimmedPrompt ||
    trimmedPrompt.length > maxPromptLength ||
    segmentationPromptIsInvalid
  ) {
    return Response.json(
      {
        error:
          task === "segmentation"
            ? "Enter one short object name or noun phrase (up to 120 characters)."
            : `Enter an image prompt up to ${MAX_UNDERSTANDING_PROMPT_CHARS} characters.`,
      },
      { status: 400 },
    )
  }
  if (image.size > MAX_VISION_IMAGE_BYTES) {
    return Response.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 })
  }

  const imageBytes = new Uint8Array(await image.arrayBuffer())
  const validation = validateVisionImage(imageBytes, image.type.toLowerCase())
  if (!validation.success) {
    return Response.json(
      { error: validation.error },
      { status: validation.error.includes("smaller than 5 MB") ? 413 : 400 },
    )
  }

  try {
    const result = await analyzeImageWithMeta({
      image: imageBytes,
      contentType: validation.contentType,
      prompt: trimmedPrompt,
      task,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    })
    if (result.kind === "understanding") {
      return Response.json({
        model: result.model,
        kind: result.kind,
        text: result.text,
      })
    }
    return Response.json({
      model: result.model,
      kind: result.kind,
      boxes: result.boxes,
    })
  } catch (error) {
    if (error instanceof MetaModelApiError) {
      console.error("Meta image analysis failed.", { status: error.status ?? null })
      return providerErrorResponse(error)
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error("Meta image analysis timed out.")
      return Response.json(
        { error: "Image analysis is taking too long. Please try again." },
        { status: 504 },
      )
    }
    console.error("Meta image analysis failed.")
    return Response.json(
      { error: "Image analysis could not be completed. Please try again." },
      { status: 502 },
    )
  }
}
