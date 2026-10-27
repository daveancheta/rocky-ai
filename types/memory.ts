export type MemoryCategory = "Preferences" | "Goals" | "People" | "Ongoing tasks"

export type Memory = {
  id: string
  category: MemoryCategory
  title: string
  detail: string
  updatedAt: string
}
