import { apiRequest } from "@/lib/api/client"
import type { AwarenessObservation } from "@/types/awareness"

export function getAwareness(signal?: AbortSignal) {
  return apiRequest<AwarenessObservation[]>("/api/awareness", { signal })
}
