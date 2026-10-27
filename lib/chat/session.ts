import "server-only"

import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"

const SESSION_COOKIE = "rocky_chat_session"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function getChatSessionId() {
  const cookieStore = await cookies()
  const existing = cookieStore.get(SESSION_COOKIE)?.value
  if (existing && UUID_PATTERN.test(existing)) return existing

  const sessionId = randomUUID()
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/chat",
    maxAge: 60 * 60 * 24 * 365,
  })
  return sessionId
}
