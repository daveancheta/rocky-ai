import { apiRequest } from "@/lib/api/client"
import type { Memory } from "@/types/memory"

export function getMemories(signal?: AbortSignal) {
  return apiRequest<Memory[]>("/api/memories", { signal })
}

export function createMemory(memory: Omit<Memory, "id" | "updatedAt">) {
  return apiRequest<Memory>("/api/memories", {
    method: "POST",
    body: JSON.stringify(memory),
  })
}

export function updateMemory(id: string, updates: Partial<Memory>) {
  return apiRequest<Memory>(`/api/memories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  })
}

export function deleteMemory(id: string) {
  return apiRequest<void>(`/api/memories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
