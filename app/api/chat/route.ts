import { randomUUID } from "node:crypto"
import { connection } from "next/server"
import { z } from "zod"
import { generateWithMuseSpark, MetaModelApiError } from "@/lib/ai/meta-provider"
import {
  conversationBelongsToSession,
  getConversation,
  getConversationHistory,
  listConversations,
  saveConversationTurn,
} from "@/lib/chat/repository"
import { getChatSessionId } from "@/lib/chat/session"
import type { MuseSparkTurn } from "@/lib/validation/meta"

const MAX_REQUEST_BYTES = 16 * 1024
const MAX_HISTORY_TURNS = 19
const MAX_HISTORY_CHARACTERS = 28_000
const CHAT_REQUEST_SCHEMA = z
  .object({
    message: z.string().trim().min(1).max(2_000),
    conversationId: z.string().uuid().optional(),
  })
  .strict()

async function readJsonBody(request: Request): Promise<
  | { success: true; value: unknown }
  | { success: false; response: Response }
> {
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    const length = Number(contentLength)
    if (!Number.isSafeInteger(length) || length < 0) {
      return {
        success: false,
        response: Response.json({ error: "Invalid request size." }, { status: 400 }),
      }
    }
    if (length > MAX_REQUEST_BYTES) {
      return {
        success: false,
        response: Response.json({ error: "Message is too large." }, { status: 413 }),
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
      if (totalBytes > MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => undefined)
        return {
          success: false,
          response: Response.json({ error: "Message is too large." }, { status: 413 }),
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

function createModelInput(
  history: Awaited<ReturnType<typeof getConversationHistory>>,
  currentMessage: string,
): { input: MuseSparkTurn[] } {
  const recentTurns: MuseSparkTurn[] = []
  let totalCharacters = currentMessage.length

  for (const message of history.slice(-MAX_HISTORY_TURNS).reverse()) {
    if (totalCharacters + message.content.length > MAX_HISTORY_CHARACTERS) break
    totalCharacters += message.content.length
    recentTurns.unshift({
      role: message.role,
      content: [
        {
          type: message.role === "user" ? "input_text" : "output_text",
          text: message.content,
        },
      ],
    })
  }

  recentTurns.push({
    role: "user",
    content: [{ type: "input_text", text: currentMessage }],
  })
  return { input: recentTurns }
}

function modelErrorResponse(error: MetaModelApiError) {
  if (!error.status) {
    const missingKey = error.message.includes("MODEL_API_KEY")
    return Response.json(
      {
        error: missingKey
          ? "Muse Spark is not configured on the server yet."
          : "Muse Spark could not be reached. Please try again.",
      },
      { status: missingKey ? 503 : 502 },
    )
  }

  if (error.status === 401) {
    return Response.json(
      { error: "Muse Spark could not authenticate MODEL_API_KEY. Check the server credential." },
      { status: 502 },
    )
  }
  if (error.status === 403) {
    return Response.json(
      { error: "This Meta API account may not have permission to use Muse Spark 1.3." },
      { status: 503 },
    )
  }
  if (error.status === 404) {
    return Response.json(
      { error: "Muse Spark 1.3 is not available to this API account." },
      { status: 503 },
    )
  }
  if (error.status === 429) {
    return Response.json(
      { error: "Muse Spark is receiving too many requests. Please try again shortly." },
      { status: 503 },
    )
  }

  return Response.json(
    { error: "Muse Spark could not complete the request. Please try again." },
    { status: 502 },
  )
}

export async function GET(request: Request) {
  await connection()

  try {
    const sessionId = await getChatSessionId()
    const conversationId = new URL(request.url).searchParams.get("conversationId")

    if (conversationId) {
      if (!z.string().uuid().safeParse(conversationId).success) {
        return Response.json({ error: "Invalid conversation ID." }, { status: 400 })
      }
      const conversation = await getConversation(sessionId, conversationId)
      if (!conversation) {
        return Response.json({ error: "Conversation not found." }, { status: 404 })
      }
      return Response.json(conversation)
    }

    return Response.json({ conversations: await listConversations(sessionId) })
  } catch {
    console.error("Could not load chat history.")
    return Response.json(
      { error: "Conversation history is temporarily unavailable." },
      { status: 503 },
    )
  }
}

export async function POST(request: Request) {
  await connection()

  const body = await readJsonBody(request)
  if (!body.success) return body.response
  const parsed = CHAT_REQUEST_SCHEMA.safeParse(body.value)
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a message up to 2,000 characters long." },
      { status: 400 },
    )
  }

  try {
    const sessionId = await getChatSessionId()
    const conversationId = parsed.data.conversationId
    if (conversationId && !(await conversationBelongsToSession(sessionId, conversationId))) {
      return Response.json({ error: "Conversation not found." }, { status: 404 })
    }

    const history = conversationId
      ? await getConversationHistory(conversationId)
      : []
    const modelInput = createModelInput(history, parsed.data.message)
    const result = await generateWithMuseSpark(modelInput, {
      signal: AbortSignal.timeout(45_000),
    })
    if (result.outputText.length > 40_000) {
      console.error("Muse Spark response exceeded the allowed text length.")
      return Response.json(
        { error: "Muse Spark returned an unusually long response. Please try again." },
        { status: 502 },
      )
    }

    const resolvedConversationId = conversationId ?? randomUUID()
    const isNewConversation = !conversationId
    const savedTurn = await saveConversationTurn({
      sessionId,
      conversationId: resolvedConversationId,
      title: parsed.data.message,
      isNewConversation,
      userMessage: parsed.data.message,
      assistantMessage: result.outputText,
    })

    return Response.json({
      conversationId: resolvedConversationId,
      model: result.model,
      userMessage: savedTurn.userMessage,
      message: savedTurn.assistantMessage,
    })
  } catch (error) {
    if (error instanceof MetaModelApiError) {
      console.error("Muse Spark request failed.", { status: error.status ?? null })
      return modelErrorResponse(error)
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error("Muse Spark request timed out.")
      return Response.json(
        { error: "Muse Spark is taking too long to respond. Please try again." },
        { status: 504 },
      )
    }
    console.error("Chat request or conversation persistence failed.")
    return Response.json(
      { error: "Your message could not be saved. Please try again." },
      { status: 503 },
    )
  }
}
