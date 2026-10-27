import { connection } from "next/server"
import { readBoundedJson } from "@/lib/api/read-json"
import { getChatSessionId } from "@/lib/chat/session"
import {
  getMemoryEnabled,
  setMemoryEnabled,
} from "@/lib/memory/repository"
import { MEMORY_PREFERENCE_SCHEMA } from "@/lib/validation/memory"

export async function GET() {
  await connection()
  try {
    const sessionId = await getChatSessionId()
    return Response.json({ enabled: await getMemoryEnabled(sessionId) })
  } catch {
    console.error("Could not load memory preference.")
    return Response.json(
      { error: "Memory preference is temporarily unavailable." },
      { status: 503 },
    )
  }
}

export async function PUT(request: Request) {
  await connection()
  const body = await readBoundedJson(request, 1_024)
  if (!body.success) return body.response
  const parsed = MEMORY_PREFERENCE_SCHEMA.safeParse(body.value)
  if (!parsed.success) {
    return Response.json({ error: "Memory preference must be enabled or disabled." }, { status: 400 })
  }

  try {
    const sessionId = await getChatSessionId()
    await setMemoryEnabled(sessionId, parsed.data.enabled)
    return Response.json({ enabled: parsed.data.enabled })
  } catch {
    console.error("Could not save memory preference.")
    return Response.json(
      { error: "Memory preference could not be saved. Please try again." },
      { status: 503 },
    )
  }
}
