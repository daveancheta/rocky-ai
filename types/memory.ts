export type MemoryCategory = "Preferences" | "Goals" | "People" | "Ongoing tasks"

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
