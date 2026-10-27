import { create } from "zustand"
import { getMemories } from "@/lib/api/memories"
import type { Memory, MemoryCategory } from "@/types/memory"

const sampleMemories: Memory[] = [
  {
    id: "pref-morning",
    category: "Preferences",
    title: "A gentle start",
    detail: "You prefer a little quiet time before the day gets busy.",
    updatedAt: "Sample memory · today",
  },
  {
    id: "goal-walk",
    category: "Goals",
    title: "More time outdoors",
    detail: "You'd like to make room for a walk a few times each week.",
    updatedAt: "Sample memory · yesterday",
  },
  {
    id: "people-sam",
    category: "People",
    title: "Sam's visit",
    detail: "Your friend Sam is someone you enjoy catching up with.",
    updatedAt: "Sample memory · Oct 18",
  },
  {
    id: "task-interview",
    category: "Ongoing tasks",
    title: "Prepare for an interview",
    detail: "You wanted to set aside time to practice your introduction.",
    updatedAt: "Sample memory · Oct 16",
  },
]

type MemoryStore = {
  memories: Memory[]
  query: string
  category: MemoryCategory | "All"
  isLoading: boolean
  error?: string
  fetchMemories: (signal?: AbortSignal) => Promise<void>
  setQuery: (query: string) => void
  setCategory: (category: MemoryCategory | "All") => void
  create: (memory: Omit<Memory, "id" | "updatedAt">) => void
  update: (id: string, title: string, detail: string) => void
  remove: (id: string) => void
  clear: () => void
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  memories: sampleMemories,
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
  create: (memory) =>
    set((state) => ({
      memories: [
        {
          ...memory,
          id: crypto.randomUUID(),
          updatedAt: "Local demo · just now",
        },
        ...state.memories,
      ],
    })),
  update: (id, title, detail) =>
    set((state) => ({
      memories: state.memories.map((memory) =>
        memory.id === id
          ? { ...memory, title, detail, updatedAt: "Local demo · just now" }
          : memory,
      ),
    })),
  remove: (id) =>
    set((state) => ({
      memories: state.memories.filter((memory) => memory.id !== id),
    })),
  clear: () => set({ memories: [] }),
}))
