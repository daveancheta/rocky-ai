import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { mainPersonImages, memories, memoryPreferences } from "@/lib/db/schema"
import { MAIN_PERSON_MEMORY_TITLE, type Memory, type MemoryCategory, type MemoryCandidate } from "@/types/memory"

function getTitleKey(title: string) {
  return title
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US")
    .slice(0, 80)
}

function toMemory(row: typeof memories.$inferSelect): Memory {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    consentStatus: row.consentStatus,
    ...(row.sourceConversationId
      ? { sourceConversationId: row.sourceConversationId }
      : {}),
  }
}

export async function listApprovedMemories(sessionId: string) {
  const rows = await getDb()
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.sessionId, sessionId),
        eq(memories.consentStatus, "approved"),
      ),
    )
    .orderBy(desc(memories.updatedAt))
    .limit(100)
  return rows.map(toMemory)
}

export async function getMainPersonMemory(sessionId: string) {
  if (!(await getMemoryEnabled(sessionId))) return undefined
  const [row] = await getDb()
    .select()
    .from(memories)
    .where(and(
      eq(memories.sessionId, sessionId),
      eq(memories.category, "People"),
      eq(memories.titleKey, getTitleKey(MAIN_PERSON_MEMORY_TITLE)),
      eq(memories.consentStatus, "approved"),
    ))
    .limit(1)
  return row ? toMemory(row) : undefined
}

async function findMainPersonMemoryId(sessionId: string) {
  const [row] = await getDb()
    .select({ id: memories.id })
    .from(memories)
    .where(and(
      eq(memories.sessionId, sessionId),
      eq(memories.category, "People"),
      eq(memories.titleKey, getTitleKey(MAIN_PERSON_MEMORY_TITLE)),
      eq(memories.consentStatus, "approved"),
    ))
    .limit(1)
  return row?.id
}

export async function saveMainPersonImage(sessionId: string, contentType: string, bytes: Uint8Array) {
  const memoryId = await findMainPersonMemoryId(sessionId)
  if (!memoryId) return false
  await getDb()
    .insert(mainPersonImages)
    .values({ memoryId, contentType, imageBase64: Buffer.from(bytes).toString("base64"), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: mainPersonImages.memoryId,
      set: { contentType, imageBase64: Buffer.from(bytes).toString("base64"), updatedAt: new Date() },
    })
  return true
}

export async function getMainPersonImage(sessionId: string) {
  const [row] = await getDb()
    .select({ contentType: mainPersonImages.contentType, imageBase64: mainPersonImages.imageBase64 })
    .from(mainPersonImages)
    .innerJoin(memories, eq(mainPersonImages.memoryId, memories.id))
    .where(and(
      eq(memories.sessionId, sessionId),
      eq(memories.category, "People"),
      eq(memories.titleKey, getTitleKey(MAIN_PERSON_MEMORY_TITLE)),
      eq(memories.consentStatus, "approved"),
    ))
    .limit(1)
  return row
}

export async function deleteMainPersonImage(sessionId: string) {
  const memoryId = await findMainPersonMemoryId(sessionId)
  if (!memoryId) return false
  const deleted = await getDb()
    .delete(mainPersonImages)
    .where(eq(mainPersonImages.memoryId, memoryId))
    .returning({ memoryId: mainPersonImages.memoryId })
  return deleted.length > 0
}

export async function saveApprovedMemory(
  sessionId: string,
  candidate: MemoryCandidate,
  sourceConversationId?: string,
) {
  const titleKey = getTitleKey(candidate.title)

  const [row] = await getDb()
    .insert(memories)
    .values({
      sessionId,
      category: candidate.category,
      title: candidate.title,
      titleKey,
      detail: candidate.detail,
      consentStatus: "approved",
      sourceConversationId: sourceConversationId ?? null,
    })
    .onConflictDoUpdate({
      target: [memories.sessionId, memories.category, memories.titleKey],
      set: {
        title: candidate.title,
        detail: candidate.detail,
        sourceConversationId: sourceConversationId ?? null,
        consentStatus: "approved",
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error("Could not save approved memory.")
  return toMemory(row)
}

export async function updateApprovedMemory(
  sessionId: string,
  memoryId: string,
  updates: {
    category?: MemoryCategory
    title?: string
    detail?: string
  },
) {
  const [row] = await getDb()
    .update(memories)
    .set({
      ...updates,
      ...(updates.title
        ? { titleKey: getTitleKey(updates.title) }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.sessionId, sessionId),
        eq(memories.consentStatus, "approved"),
      ),
    )
    .returning()

  return row ? toMemory(row) : undefined
}

export async function deleteApprovedMemory(
  sessionId: string,
  memoryId: string,
) {
  const deleted = await getDb()
    .delete(memories)
    .where(
      and(
        eq(memories.id, memoryId),
        eq(memories.sessionId, sessionId),
      ),
    )
    .returning({ id: memories.id })
  return deleted.length > 0
}

export async function clearApprovedMemories(sessionId: string) {
  await getDb()
    .delete(memories)
    .where(eq(memories.sessionId, sessionId))
}

export async function getMemoryEnabled(sessionId: string) {
  const [preference] = await getDb()
    .select({ enabled: memoryPreferences.enabled })
    .from(memoryPreferences)
    .where(eq(memoryPreferences.sessionId, sessionId))
    .limit(1)
  return preference?.enabled ?? true
}

export async function setMemoryEnabled(
  sessionId: string,
  enabled: boolean,
) {
  await getDb()
    .insert(memoryPreferences)
    .values({ sessionId, enabled, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: memoryPreferences.sessionId,
      set: { enabled, updatedAt: new Date() },
    })
}

const STOP_WORDS = new Set(
  "about after again against also and are because been before being between but can could did does doing down during each few for from further had has have having here hers herself him himself his how into its itself just more most other our ours ourselves out over own same she should some such than that the their theirs them themselves then there these they this those through under until upon very was were what when where which while who whom why will with would your yours you yourself yourselves".split(
    " ",
  ),
)
const MAX_INJECTED_MEMORIES = 5
const MAX_MEMORY_CONTEXT_CHARS = 2_500

function getTerms(text: string) {
  return new Set(
    (text.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]{3,}/gu) ?? [])
      .filter((term) => !STOP_WORDS.has(term)),
  )
}

export async function getRelevantApprovedMemories(
  sessionId: string,
  userMessage: string,
) {
  if (!(await getMemoryEnabled(sessionId))) return []

  const approved = await listApprovedMemories(sessionId)
  const messageTerms = getTerms(userMessage)
  if (messageTerms.size === 0) return []

  const ranked = approved
    .map((memory) => {
      const terms = getTerms(`${memory.title} ${memory.detail}`)
      const overlap = [...terms].filter((term) => messageTerms.has(term)).length
      return { memory, overlap }
    })
    .filter((item) => item.overlap > 0)
    .sort(
      (first, second) =>
        second.overlap - first.overlap ||
        second.memory.updatedAt.localeCompare(first.memory.updatedAt),
    )

  const result: Memory[] = []
  let totalChars = 0
  for (const { memory } of ranked) {
    const text = `${memory.title}: ${memory.detail}`
    if (totalChars + text.length > MAX_MEMORY_CONTEXT_CHARS) continue
    result.push(memory)
    totalChars += text.length
    if (result.length >= MAX_INJECTED_MEMORIES) break
  }
  return result
}
