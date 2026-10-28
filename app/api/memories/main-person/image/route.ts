import { connection } from "next/server"
import { getChatSessionId } from "@/lib/chat/session"
import {
  deleteMainPersonImage,
  getMainPersonImage,
  getMemoryEnabled,
  saveMainPersonImage,
} from "@/lib/memory/repository"
import { validateVisionImage } from "@/lib/validation/image"

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 32 * 1024

type BodyResult = { success: true; bytes: Uint8Array } | { success: false; response: Response }

async function readBoundedBody(request: Request): Promise<BodyResult> {
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null && Number(contentLength) > MAX_MULTIPART_BYTES) {
    return { success: false, response: Response.json({ error: "Choose a profile image smaller than 2 MB." }, { status: 413 }) }
  }
  if (!request.body) {
    return { success: false, response: Response.json({ error: "Choose a profile image to upload." }, { status: 400 }) }
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
        return { success: false, response: Response.json({ error: "Choose a profile image smaller than 2 MB." }, { status: 413 }) }
      }
      chunks.push(value)
    }
  } catch {
    return { success: false, response: Response.json({ error: "The profile image upload could not be read." }, { status: 400 }) }
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

export async function GET() {
  await connection()
  try {
    const sessionId = await getChatSessionId()
    const image = await getMainPersonImage(sessionId)
    if (!image) return Response.json({ error: "No saved profile image." }, { status: 404 })
    const bytes = Buffer.from(image.imageBase64, "base64")
    return new Response(bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    })
  } catch {
    console.error("Could not load the main person profile image.")
    return Response.json({ error: "The profile image is temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  await connection()
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data;")) {
    return Response.json({ error: "Send the profile image as multipart form data." }, { status: 400 })
  }
  const boundedBody = await readBoundedBody(request)
  if (!boundedBody.success) return boundedBody.response

  let formData: FormData
  try {
    const multipartBody = new ArrayBuffer(boundedBody.bytes.byteLength)
    new Uint8Array(multipartBody).set(boundedBody.bytes)
    formData = await new Response(multipartBody, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData()
  } catch {
    return Response.json({ error: "The profile image upload is malformed." }, { status: 400 })
  }
  const files = formData.getAll("image")
  if (files.length !== 1 || !(files[0] instanceof File)) {
    return Response.json({ error: "Choose one profile image." }, { status: 400 })
  }
  const file = files[0]
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Choose a profile image smaller than 2 MB." }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const validation = validateVisionImage(bytes, file.type.toLowerCase())
  if (!validation.success) return Response.json({ error: validation.error }, { status: 400 })

  try {
    const sessionId = await getChatSessionId()
    if (!(await getMemoryEnabled(sessionId))) {
      return Response.json({ error: "Memory is disabled. Turn it on in Settings before saving an image." }, { status: 409 })
    }
    const saved = await saveMainPersonImage(sessionId, validation.contentType, bytes)
    if (!saved) return Response.json({ error: "Save the main person or character profile before adding its image." }, { status: 404 })
    return Response.json({ saved: true })
  } catch {
    console.error("Could not save the main person profile image.")
    return Response.json({ error: "The profile image could not be saved. Please try again." }, { status: 503 })
  }
}

export async function DELETE() {
  await connection()
  try {
    const sessionId = await getChatSessionId()
    const deleted = await deleteMainPersonImage(sessionId)
    if (!deleted) return Response.json({ error: "No saved profile image was found." }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch {
    console.error("Could not delete the main person profile image.")
    return Response.json({ error: "The profile image could not be deleted. Please try again." }, { status: 503 })
  }
}
