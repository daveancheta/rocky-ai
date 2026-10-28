export type MemoryCategory = "Preferences" | "Goals" | "People" | "Ongoing tasks"
export const MAIN_PERSON_MEMORY_TITLE = "Main person or character"
export const PERSON_PROFILE_TITLE_PREFIX = "Person: "

export function personProfileTitle(name: string) {
  return `${PERSON_PROFILE_TITLE_PREFIX}${name.trim()}`
}

export function isMainPersonMemory(memory: Pick<Memory, "category" | "title">) {
  return memory.category === "People" && (
    memory.title === MAIN_PERSON_MEMORY_TITLE || memory.title.startsWith(PERSON_PROFILE_TITLE_PREFIX)
  )
}

export type Memory = {
  id: string
  category: MemoryCategory
  title: string
  detail: string
  createdAt: string
  updatedAt: string
  sourceConversationId?: string
  consentStatus: "approved"
}

export type MemoryCandidate = Pick<Memory, "category" | "title" | "detail">

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  "Preferences",
  "Goals",
  "People",
  "Ongoing tasks",
]
