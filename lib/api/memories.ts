import { ApiError, apiRequest } from "@/lib/api/client"
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

export async function getMainPersonImage(memoryId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/memories/main-person/image?memoryId=${encodeURIComponent(memoryId)}`, {
    signal,
    cache: "no-store",
  })
  if (response.status === 404) return undefined
  if (!response.ok) {
    let message = "The profile image could not be loaded."
    try {
      const body: unknown = await response.json()
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error
      }
    } catch {
      // Keep the generic message if the server returned no JSON error.
    }
    throw new ApiError(message, response.status)
  }
  return response.blob()
}

export function saveMainPersonImage(memoryId: string, image: File) {
  const body = new FormData()
  body.append("image", image, image.name)
  return apiRequest<{ saved: true }>(`/api/memories/main-person/image?memoryId=${encodeURIComponent(memoryId)}`, {
    method: "POST",
    body,
  })
}

export function deleteMainPersonImage(memoryId: string) {
  return apiRequest<void>(`/api/memories/main-person/image?memoryId=${encodeURIComponent(memoryId)}`, { method: "DELETE" })
}
