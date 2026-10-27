import { connection } from "next/server"
import { z } from "zod"
import { readBoundedJson } from "@/lib/api/read-json"
import { getChatSessionId } from "@/lib/chat/session"
import {
  deleteApprovedMemory,
  updateApprovedMemory,
} from "@/lib/memory/repository"
import { MEMORY_UPDATE_SCHEMA } from "@/lib/validation/memory"

type RouteContext = {
  params: Promise<{ memoryId: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  await connection()
  const { memoryId } = await params
  if (!z.string().uuid().safeParse(memoryId).success) {
    return Response.json({ error: "Invalid memory ID." }, { status: 400 })
  }

  const body = await readBoundedJson(request, 8 * 1024)
  if (!body.success) return body.response
  const parsed = MEMORY_UPDATE_SCHEMA.safeParse(body.value)
  if (!parsed.success) {
    return Response.json({ error: "Enter valid memory details." }, { status: 400 })
  }

  try {
    const sessionId = await getChatSessionId()
    const memory = await updateApprovedMemory(sessionId, memoryId, parsed.data)
    if (!memory) return Response.json({ error: "Memory not found." }, { status: 404 })
    return Response.json(memory)
  } catch {
    console.error("Could not update an approved memory.")
    return Response.json(
      { error: "Memory could not be updated. Please try again." },
      { status: 503 },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  await connection()
  const { memoryId } = await params
  if (!z.string().uuid().safeParse(memoryId).success) {
    return Response.json({ error: "Invalid memory ID." }, { status: 400 })
  }

  try {
    const sessionId = await getChatSessionId()
    const deleted = await deleteApprovedMemory(sessionId, memoryId)
    if (!deleted) return Response.json({ error: "Memory not found." }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch {
    console.error("Could not delete an approved memory.")
    return Response.json(
      { error: "Memory could not be deleted. Please try again." },
      { status: 503 },
    )
  }
}
