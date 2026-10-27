import { create } from "zustand"
import { getAwareness } from "@/lib/api/awareness"
import type { AwarenessObservation } from "@/types/awareness"

type CameraPermission = "unknown" | "granted" | "denied" | "unsupported"
type ConnectionStatus = "disconnected" | "connecting" | "connected"

type AwarenessStore = {
  isEnabled: boolean
  isLoading: boolean
  error?: string
  cameraPermission: CameraPermission
  connectionStatus: ConnectionStatus
  observations: AwarenessObservation[]
  fetchObservations: (signal?: AbortSignal) => Promise<void>
  setEnabled: (enabled: boolean) => void
  dismiss: (id: string) => void
}

const sampleObservations: AwarenessObservation[] = [
  {
    id: "sample-focus",
    category: "A gentle nudge",
    message: "Would a short pause help you reset before your next task?",
    time: "A sample suggestion",
    isDemo: true,
  },
]

export const useAwarenessStore = create<AwarenessStore>((set) => ({
  isEnabled: false,
  isLoading: false,
  cameraPermission: "unknown",
  connectionStatus: "disconnected",
  observations: sampleObservations,
  fetchObservations: async (signal) => {
    set({ isLoading: true, error: undefined })
    try {
      const observations = await getAwareness(signal)
      set({ observations, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to load awareness.",
      })
      throw error
    }
  },
  setEnabled: (isEnabled) => set({ isEnabled }),
  dismiss: (id) =>
    set((state) => ({
      observations: state.observations.filter((item) => item.id !== id),
    })),
}))
