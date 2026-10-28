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
import {
  deleteApprovedMemory,
  getMainPersonMemory,
  getMemoryEnabled,
  getRelevantApprovedMemories,
  listApprovedMemories,
  saveApprovedMemory,
} from "@/lib/memory/repository"
import { orchestrateConversation } from "@/lib/companion/orchestrate"
import { isVisualAwarenessQuestion } from "@/lib/companion/vision-change"
import type { MemoryCategory } from "@/types/memory"

const MAX_REQUEST_BYTES = 16 * 1024
const CHAT_REQUEST_SCHEMA = z
  .object({
    message: z.string().trim().min(1).max(2_000),
    conversationId: z.string().uuid().optional(),
    personality: z.enum(["Calm", "Friendly", "Playful", "Supportive"]).default("Calm"),
    observation: z.object({
      text: z.string().trim().min(1).max(8_000),
      observedAt: z.string().datetime(),
      confidence: z.number().min(0).max(1).optional(),
      targeted: z.boolean().optional(),
    }).strict().optional(),
    visualAvailability: z.enum(["off", "inactive", "waiting", "uncertain", "error"]).optional(),
    visualError: z.string().trim().max(240).optional(),
  })
  .strict()

const SENSITIVE_MEMORY_CONTENT =
  /\b(password|passcode|secret|api key|access token|token|credential|private key|recovery code|credit card|bank account|social security|ssn|passport|medical|diagnos\w*|depression|anxiety|bipolar|medication|prescription|therapy|disability|sexual|political party|religion|religious|christian|muslim|catholic|jewish|hindu|buddhist|atheist|home address|street address|phone number|email address|date of birth|financial account)\b/i

function parseMemoryCommand(message: string) {
  const remember = message.match(/^\s*(?:(?:rocky|please)\s*[,;:]?\s*)*(?:(?:can you|i want you to)\s+)?(?:please\s+)?remember(?:\s+that)?\s*[:,-]?\s*(.*?)\s*[.!?]*\s*$/i)
  if (remember) return { kind: "remember" as const, detail: remember[1].trim() }

  const recall = message.match(/\b(?:what|which) (?:do you )?remember(?: about (.+?))?[?.!]*$/i)
    ?? message.match(/\btell me what you remember(?: about (.+?))?[?.!]*$/i)
  if (recall) return { kind: "recall" as const, target: recall[1]?.trim() }

  const forget = message.match(/^\s*(?:(?:rocky|please)\s*[,;:]?\s*)*(?:forget|remove|delete)\s+(?:the\s+)?(?:memory\s+(?:about|that)\s+)?(.+?)\s*[.!?]*\s*$/i)
  if (forget) return { kind: "forget" as const, target: forget[1].trim() }
  return undefined
}

const MEMORY_STOP_WORDS = new Set("about after and are for from that the this with you your my me remember".split(" "))

function memoryTerms(value: string) {
  return [...new Set((value.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((term) => !MEMORY_STOP_WORDS.has(term)))]
}

function describeMemory(detail: string) {
  const trimmed = detail.replace(/^(?:that\s+)?(?:i\s+)?(?:want you to\s+)?/i, "").trim()
  const category: MemoryCategory = /\b(prefer|like|love|hate|always|never|response|language|style)\b/i.test(trimmed)
      ? "Preferences"
      : /\b(goal|learn|study|working on|project|finish|plan to)\b/i.test(trimmed)
        ? "Goals"
        : /\b(need to|remind me|follow up|unfinished|still have to|every day|every week|every morning|every evening|daily|weekly|routine|habit)\b/i.test(trimmed)
          ? "Ongoing tasks"
          : "People"
  const firstSentence = trimmed.split(/[.!?]/, 1)[0].trim()
  const title = firstSentence.slice(0, 80) || "Remembered detail"
  return { category, title, detail: trimmed.slice(0, 500) }
}

async function handleMemoryCommand(sessionId: string, message: string) {
  const command = parseMemoryCommand(message)
  if (!command) return undefined
  if (!(await getMemoryEnabled(sessionId))) {
    return "Long-term memory is off, so I can’t use or change saved memories right now. You can turn it on in Settings."
  }

  if (command.kind === "remember") {
    if (!command.detail || /^(?:this|that|it|something)$/i.test(command.detail)) {
      return "What would you like me to remember?"
    }
    if (SENSITIVE_MEMORY_CONTENT.test(command.detail)) {
      return "I can’t save passwords, secrets, or sensitive personal information as a memory."
    }
    const memory = await saveApprovedMemory(sessionId, describeMemory(command.detail))
    return `Got it. I’ll remember: ${memory.detail}`
  }

  const memories = await listApprovedMemories(sessionId)
  if (command.kind === "recall") {
    if (!memories.length) return "I don’t have any approved memories saved for you yet."
    const terms = command.target ? memoryTerms(command.target) : []
    const matchingMemories = terms.length
      ? memories.filter((memory) => {
          const content = `${memory.title} ${memory.detail}`.toLocaleLowerCase("en-US")
          return terms.some((term) => content.includes(term))
        })
      : memories
    if (!matchingMemories.length) return "I don’t have an approved memory saved about that."
    const summary = matchingMemories.slice(0, 12).map((memory) => `${memory.title}: ${memory.detail}`).join("; ")
    return `Here’s what I have saved${command.target ? ` about ${command.target}` : ""}: ${summary}${matchingMemories.length > 12 ? "; and more in your Memories page" : ""}`
  }

  if (/^(?:all|everything|all memories|all of my memories|all my memories)$/i.test(command.target)) {
    return "For safety, I can’t delete all memories by voice. You can review and delete them in Settings."
  }
  const targetTerms = memoryTerms(command.target)
  if (!targetTerms.length) return "Which saved memory would you like me to forget?"
  const ranked = memories.map((memory) => {
    const content = `${memory.title} ${memory.detail}`.toLocaleLowerCase("en-US")
    const overlap = targetTerms.filter((term) => content.includes(term)).length
    return { memory, overlap }
  }).filter((item) => item.overlap > 0).sort((a, b) => b.overlap - a.overlap)
  if (!ranked.length) return "I couldn’t find a saved memory matching that. You can review all memories on the Memories page."
  if (ranked.length > 1 || targetTerms.length < 2 || ranked[0].overlap < targetTerms.length) {
    const choices = ranked.slice(0, 3).map(({ memory }) => memory.title).join(", ")
    return ranked.length > 1
      ? `I found a few possible memories: ${choices}. Which one should I forget?`
      : `Did you mean “${choices}”? Please name the memory you want me to forget.`
  }
  const deleted = await deleteApprovedMemory(sessionId, ranked[0].memory.id)
  return deleted ? `Done. I deleted the memory “${ranked[0].memory.title}”.` : "I couldn’t delete that memory. Please try again."
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

function visualAvailabilityResponse(status: "off" | "inactive" | "waiting" | "uncertain" | "error", detail?: string) {
  switch (status) {
    case "off":
      return "I can only answer from a camera still when camera observation is enabled in Settings and the companion session is running."
    case "inactive":
      return "Camera observation is not active in this companion session. Start a session with camera observation enabled, and I can check a still image."
    case "waiting":
      return "Camera observation is on, but I don't have a still image ready yet. Please ask me again in a moment."
    case "uncertain":
      return "I checked a still image, but couldn't identify the scene confidently enough to tell whether your face is visible. Try improving the lighting or moving into the camera frame, then ask me again."
    case "error":
      return `I couldn't analyze the latest camera still${detail ? `: ${detail}` : ". Please try again shortly."}`
  }
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
    let memoryCommandResponse: string | undefined
    try {
      memoryCommandResponse = await handleMemoryCommand(sessionId, parsed.data.message)
    } catch {
      console.error("Memory command failed.")
      return Response.json(
        { error: "The memory request could not be completed. Your saved memories were not confirmed as changed." },
        { status: 503 },
      )
    }
    if (memoryCommandResponse) {
      const resolvedConversationId = conversationId ?? randomUUID()
      const savedTurn = await saveConversationTurn({
        sessionId,
        conversationId: resolvedConversationId,
        title: parsed.data.message,
        isNewConversation: !conversationId,
        userMessage: parsed.data.message,
        assistantMessage: memoryCommandResponse,
      })
      return Response.json({
        conversationId: resolvedConversationId,
        model: "memory-command",
        userMessage: savedTurn.userMessage,
        message: savedTurn.assistantMessage,
      })
    }
    if (parsed.data.visualAvailability && isVisualAwarenessQuestion(parsed.data.message)) {
      const resolvedConversationId = conversationId ?? randomUUID()
      const visualResponse = visualAvailabilityResponse(
        parsed.data.visualAvailability,
        parsed.data.visualError,
      )
      const savedTurn = await saveConversationTurn({
        sessionId,
        conversationId: resolvedConversationId,
        title: parsed.data.message,
        isNewConversation: !conversationId,
        userMessage: parsed.data.message,
        assistantMessage: visualResponse,
      })
      return Response.json({
        conversationId: resolvedConversationId,
        model: "visual-availability",
        userMessage: savedTurn.userMessage,
        message: savedTurn.assistantMessage,
      })
    }
    let relevantMemories: Awaited<ReturnType<typeof getRelevantApprovedMemories>> = []
    let mainPerson: Awaited<ReturnType<typeof getMainPersonMemory>> = []
    try {
      [relevantMemories, mainPerson] = await Promise.all([
        getRelevantApprovedMemories(sessionId, parsed.data.message),
        getMainPersonMemory(sessionId),
      ])
    } catch {
      console.error("Approved memory retrieval failed; continuing without memory context.")
    }
    const observationAge = parsed.data.observation
      ? Date.now() - Date.parse(parsed.data.observation.observedAt)
      : Number.POSITIVE_INFINITY
    const currentObservation = parsed.data.observation && observationAge >= 0 && observationAge < 3 * 60_000
      ? parsed.data.observation
      : undefined
    const conversation = orchestrateConversation({
      history,
      message: parsed.data.message,
      memories: relevantMemories,
      mainPeople: mainPerson.slice(0, 5).map(({ title, detail }) => ({ title, detail })),
      personality: parsed.data.personality,
      observation: currentObservation,
      visualAvailability: currentObservation ? undefined : parsed.data.visualAvailability,
      visualError: currentObservation ? undefined : parsed.data.visualError,
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
