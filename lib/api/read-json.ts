export type JsonBodyResult =
  | { success: true; value: unknown }
  | { success: false; response: Response }

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    const length = Number(contentLength)
    if (!Number.isSafeInteger(length) || length < 0) {
      return {
        success: false,
        response: Response.json({ error: "Invalid request size." }, { status: 400 }),
      }
    }
    if (length > maxBytes) {
      return {
        success: false,
        response: Response.json({ error: "Request body is too large." }, { status: 413 }),
      }
    }
  }

  if (!request.body) {
    return {
      success: false,
      response: Response.json({ error: "Request body is required." }, { status: 400 }),
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
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined)
        return {
          success: false,
          response: Response.json({ error: "Request body is too large." }, { status: 413 }),
        }
      }
      chunks.push(value)
    }
  } catch {
    return {
      success: false,
      response: Response.json({ error: "Could not read the request body." }, { status: 400 }),
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

  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return {
      success: false,
      response: Response.json({ error: "Request body must be valid UTF-8." }, { status: 400 }),
    }
  }

  try {
    return { success: true, value: JSON.parse(text) as unknown }
  } catch {
    return {
      success: false,
      response: Response.json({ error: "Request body must contain valid JSON." }, { status: 400 }),
    }
  }
}
