import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { chatMessages, conversations } from "@/lib/db/schema"
import type { ChatMessage } from "@/types/chat"

const HISTORY_LIMIT = 40

function toChatMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listConversations(sessionId: string) {
  const rows = await getDb()
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function getConversation(
  sessionId: string,
  conversationId: string,
) {
  const [conversation] = await getDb()
    .select({
      id: conversations.id,
      title: conversations.title,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1)

  if (!conversation) return undefined

  const rows = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(HISTORY_LIMIT)

  return {
    ...conversation,
    messages: rows.reverse().map(toChatMessage),
  }
}

export async function getConversationHistory(conversationId: string) {
  const rows = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(HISTORY_LIMIT)

  return rows.reverse()
}

export async function saveConversationTurn(input: {
  sessionId: string
  conversationId: string
  title: string
  isNewConversation: boolean
  userMessage: string
  assistantMessage: string
}) {
  const db = getDb()
  const now = new Date()
  const userMessageId = crypto.randomUUID()
  const assistantMessageId = crypto.randomUUID()
  const [user, assistant] = [
    {
      id: userMessageId,
      conversationId: input.conversationId,
      role: "user" as const,
      content: input.userMessage,
      createdAt: now,
    },
    {
      id: assistantMessageId,
      conversationId: input.conversationId,
      role: "assistant" as const,
      content: input.assistantMessage,
      createdAt: new Date(now.getTime() + 1),
    },
  ]

  const insertConversation = input.isNewConversation
    ? db.insert(conversations).values({
        id: input.conversationId,
        sessionId: input.sessionId,
        title: input.title.slice(0, 80),
        createdAt: now,
        updatedAt: now,
      })
    : db
        .update(conversations)
        .set({ updatedAt: now })
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.sessionId, input.sessionId),
          ),
        )

  await db.batch([
    insertConversation,
    db.insert(chatMessages).values([user, assistant]),
  ])

  return {
    userMessage: toChatMessage(user),
    assistantMessage: toChatMessage(assistant),
  }
}

export async function conversationBelongsToSession(
  sessionId: string,
  conversationId: string,
) {
  const [conversation] = await getDb()
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1)
  return Boolean(conversation)
}
