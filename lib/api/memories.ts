import { apiRequest } from "@/lib/api/client"
import type {
  Memory,
  MemoryCandidate,
} from "@/types/memory"

export function getMemories(signal?: AbortSignal) {
  return apiRequest<Memory[]>("/api/memories", { signal })
}

export function createMemory(
  memory: MemoryCandidate & {
    approved: true
    sourceConversationId?: string
  },
) {
  return apiRequest<Memory>("/api/memories", {
    method: "POST",
    body: JSON.stringify(memory),
  })
}

export function updateMemory(
  id: string,
  updates: Partial<MemoryCandidate>,
) {
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

export function deleteAllMemories() {
  return apiRequest<void>("/api/memories", { method: "DELETE" })
}

export function getMemoryPreference(signal?: AbortSignal) {
  return apiRequest<{ enabled: boolean }>("/api/memories/preferences", { signal })
}

export function updateMemoryPreference(enabled: boolean) {
  return apiRequest<{ enabled: boolean }>("/api/memories/preferences", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  })
}

export function suggestMemories(conversationId: string) {
  return apiRequest<{ candidates: MemoryCandidate[] }>("/api/memories/suggestions", {
    method: "POST",
    body: JSON.stringify({ conversationId }),
  })
}
