import { create } from "zustand"
import {
  createMemory,
  deleteAllMemories,
  deleteMemory,
  getMemories,
  updateMemory,
} from "@/lib/api/memories"
import type { Memory, MemoryCategory, MemoryCandidate } from "@/types/memory"

type MemoryStore = {
  memories: Memory[]
  query: string
  category: MemoryCategory | "All"
  isLoading: boolean
  error?: string
  fetchMemories: (signal?: AbortSignal) => Promise<void>
  setQuery: (query: string) => void
  setCategory: (category: MemoryCategory | "All") => void
  create: (
    memory: MemoryCandidate & { sourceConversationId?: string },
  ) => Promise<Memory>
  update: (id: string, updates: Partial<MemoryCandidate>) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: () => Promise<void>
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  memories: [],
  query: "",
  category: "All",
  isLoading: false,
  fetchMemories: async (signal) => {
    set({ isLoading: true, error: undefined })
    try {
      const memories = await getMemories(signal)
      set({ memories, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to load memories.",
      })
      throw error
    }
  },
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  create: async (memory) => {
    set({ error: undefined })
    try {
      const saved = await createMemory({ ...memory, approved: true })
      set((state) => ({
        memories: [
          saved,
          ...state.memories.filter((item) => item.id !== saved.id),
        ],
      }))
      return saved
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unable to save memory.",
      })
      throw error
    }
  },
  update: async (id, updates) => {
    set({ error: undefined })
    try {
      const updated = await updateMemory(id, updates)
      set((state) => ({
        memories: state.memories.map((memory) =>
          memory.id === id ? updated : memory,
        ),
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unable to update memory.",
      })
      throw error
    }
  },
  remove: async (id) => {
    set({ error: undefined })
    try {
      await deleteMemory(id)
      set((state) => ({
        memories: state.memories.filter((memory) => memory.id !== id),
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unable to delete memory.",
      })
      throw error
    }
  },
  clear: async () => {
    set({ error: undefined })
    try {
      await deleteAllMemories()
      set({ memories: [] })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unable to clear memories.",
      })
      throw error
    }
  },
}))
