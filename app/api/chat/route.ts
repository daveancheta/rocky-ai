import { randomUUID } from "node:crypto"
import { connection } from "next/server"
import { z } from "zod"
import { generateWithMuseSpark, MetaModelApiError } from "@/lib/ai/meta-provider"
import { readBoundedJson } from "@/lib/api/read-json"
import {
  conversationBelongsToSession,
  getConversation,
  getConversationHistory,
  listConversations,
  saveConversationTurn,
} from "@/lib/chat/repository"
import { getChatSessionId } from "@/lib/chat/session"
import { getRelevantApprovedMemories } from "@/lib/memory/repository"
import { orchestrateConversation } from "@/lib/companion/orchestrate"

const MAX_REQUEST_BYTES = 16 * 1024
const CHAT_REQUEST_SCHEMA = z
  .object({
    message: z.string().trim().min(1).max(2_000),
    conversationId: z.string().uuid().optional(),
    personality: z.enum(["Calm", "Friendly", "Playful", "Supportive"]).default("Calm"),
    observation: z.object({
      text: z.string().trim().min(1).max(8_000),
      observedAt: z.string().datetime(),
    }).strict().optional(),
  })
  .strict()

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

  const body = await readBoundedJson(request, MAX_REQUEST_BYTES)
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
    let relevantMemories: Awaited<ReturnType<typeof getRelevantApprovedMemories>> = []
    try {
      relevantMemories = await getRelevantApprovedMemories(
        sessionId,
        parsed.data.message,
      )
    } catch {
      console.error("Approved memory retrieval failed; continuing without memory context.")
    }
    const observationAge = parsed.data.observation
      ? Date.now() - Date.parse(parsed.data.observation.observedAt)
      : Number.POSITIVE_INFINITY
    const conversation = orchestrateConversation({
      history,
      message: parsed.data.message,
      memories: relevantMemories,
      personality: parsed.data.personality,
      observation: parsed.data.observation && observationAge >= 0 && observationAge < 10 * 60_000
        ? parsed.data.observation
        : undefined,
    })
    const result = await generateWithMuseSpark({ input: conversation.input }, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
      instructions: conversation.instructions,
    })
    if (request.signal.aborted) return new Response(null, { status: 499 })
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
