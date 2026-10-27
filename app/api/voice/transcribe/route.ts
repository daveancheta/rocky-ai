import { connection } from "next/server"
import { MetaModelApiError, transcribeWithMuseVoice } from "@/lib/ai/meta-provider"
import { validateTranscriptionWav } from "@/lib/validation/audio"

const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_AUDIO_BYTES + 64 * 1024

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
        response: Response.json({ error: "Recording must be smaller than 8 MB." }, { status: 413 }),
      }
    }
  }

  if (!request.body) {
    return {
      success: false,
      response: Response.json({ error: "A recording is required." }, { status: 400 }),
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
            { error: "Recording must be smaller than 8 MB." },
            { status: 413 },
          ),
        }
      }
      chunks.push(value)
    }
  } catch {
    return {
      success: false,
      response: Response.json({ error: "Could not read the recording." }, { status: 400 }),
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
          ? "Voice transcription is not configured on the server."
          : "Voice transcription could not be reached. Please try again.",
      },
      { status: missingKey ? 503 : 502 },
    )
  }
  if (error.status === 401) {
    return Response.json({ error: "Voice transcription could not authenticate." }, { status: 502 })
  }
  if (error.status === 403 || error.status === 404) {
    return Response.json(
      { error: "Muse Voice Transcribe is not available to this Meta API account." },
      { status: 503 },
    )
  }
  if (error.status === 429) {
    return Response.json(
      { error: "Voice transcription is busy. Please try again shortly." },
      { status: 503 },
    )
  }
  return Response.json(
    { error: "Voice transcription could not complete the request. Please try again." },
    { status: 502 },
  )
}

export async function POST(request: Request) {
  await connection()

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return Response.json({ error: "Send the recording as multipart form data." }, { status: 400 })
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
    return Response.json({ error: "The recording upload is malformed." }, { status: 400 })
  }

  const audioParts = formData.getAll("audio")
  const audioFile = audioParts[0]
  if (audioParts.length !== 1 || !(audioFile instanceof File)) {
    return Response.json({ error: "Provide one WAV recording." }, { status: 400 })
  }
  if (
    !["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"].includes(
      audioFile.type.toLowerCase(),
    )
  ) {
    return Response.json({ error: "Audio must use the WAV format." }, { status: 400 })
  }
  if (audioFile.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Recording must be smaller than 8 MB." }, { status: 413 })
  }

  const audio = new Uint8Array(await audioFile.arrayBuffer())
  const validation = validateTranscriptionWav(audio)
  if (!validation.success) {
    const tooLargeOrLong =
      audio.byteLength > MAX_AUDIO_BYTES ||
      validation.error === "Recordings must be two minutes or shorter."
    return Response.json(
      { error: validation.error },
      { status: tooLargeOrLong ? 413 : 400 },
    )
  }

  try {
    const result = await transcribeWithMuseVoice(audio, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
    })
    if (!result.transcript) {
      return Response.json(
        { error: "No speech was recognized. Try again in a quieter place." },
        { status: 422 },
      )
    }
    if (result.transcript.length > 2_000) {
      return Response.json(
        { error: "The transcript is over 2,000 characters. Please record a shorter clip." },
        { status: 422 },
      )
    }
    return Response.json({ transcript: result.transcript })
  } catch (error) {
    if (error instanceof MetaModelApiError) {
      console.error("Muse Voice transcription failed.", { status: error.status ?? null })
      return providerErrorResponse(error)
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error("Muse Voice transcription timed out.")
      return Response.json(
        { error: "Transcription is taking too long. Please try again." },
        { status: 504 },
      )
    }
    console.error("Muse Voice transcription failed.")
    return Response.json(
      { error: "Transcription could not be completed. Please try again." },
      { status: 502 },
    )
  }
}
