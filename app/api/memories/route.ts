import { connection } from "next/server"
import { readBoundedJson } from "@/lib/api/read-json"
import { getChatSessionId } from "@/lib/chat/session"
import { conversationBelongsToSession } from "@/lib/chat/repository"
import {
  clearApprovedMemories,
  listApprovedMemories,
  saveApprovedMemory,
} from "@/lib/memory/repository"
import { MEMORY_CREATE_SCHEMA } from "@/lib/validation/memory"

const MAX_MEMORY_REQUEST_BYTES = 8 * 1024

export async function GET() {
  await connection()
  try {
    const sessionId = await getChatSessionId()
    return Response.json(await listApprovedMemories(sessionId))
  } catch {
    console.error("Could not load approved memories.")
    return Response.json(
      { error: "Memories are temporarily unavailable." },
      { status: 503 },
    )
  }
}

export async function POST(request: Request) {
  await connection()
  const body = await readBoundedJson(request, MAX_MEMORY_REQUEST_BYTES)
  if (!body.success) return body.response
  const parsed = MEMORY_CREATE_SCHEMA.safeParse(body.value)
  if (!parsed.success) {
    return Response.json(
      { error: "Review the memory details and confirm that you want to save it." },
      { status: 400 },
    )
  }

  try {
    const sessionId = await getChatSessionId()
    if (
      parsed.data.sourceConversationId &&
      !(await conversationBelongsToSession(
        sessionId,
        parsed.data.sourceConversationId,
      ))
    ) {
      return Response.json({ error: "Source conversation not found." }, { status: 404 })
    }

    const memory = await saveApprovedMemory(
      sessionId,
      {
        category: parsed.data.category,
        title: parsed.data.title,
        detail: parsed.data.detail,
      },
      parsed.data.sourceConversationId,
    )
    return Response.json(memory, { status: 201 })
  } catch {
    console.error("Could not save an approved memory.")
    return Response.json(
      { error: "Memory could not be saved. Please try again." },
      { status: 503 },
    )
  }
}

export async function DELETE() {
  await connection()
  try {
    const sessionId = await getChatSessionId()
    await clearApprovedMemories(sessionId)
    return new Response(null, { status: 204 })
  } catch {
    console.error("Could not clear approved memories.")
    return Response.json(
      { error: "Memories could not be cleared. Please try again." },
      { status: 503 },
    )
  }
}
