import { create } from "zustand"
import { getAwareness } from "@/lib/api/awareness"
import type { AwarenessObservation } from "@/types/awareness"
import type { VisionSnapshot } from "@/lib/companion/vision-change"

export type VisionProcessingStatus = "idle" | "capturing" | "processing" | "ready" | "uncertain" | "error"

type CameraPermission = "unknown" | "granted" | "denied" | "unsupported"
type ConnectionStatus = "disconnected" | "connecting" | "connected"

type AwarenessStore = {
  isEnabled: boolean
  isLoading: boolean
  error?: string
  cameraPermission: CameraPermission
  connectionStatus: ConnectionStatus
  observations: AwarenessObservation[]
  latestVisionObservation?: { text: string; observedAt: string; image?: Blob; snapshot?: VisionSnapshot }
  visionStatus: VisionProcessingStatus
  visionLastAttemptAt?: string
  visionError?: string
  requestVisionObservation?: () => void
  fetchObservations: (signal?: AbortSignal) => Promise<void>
  setEnabled: (enabled: boolean) => void
  setLatestVisionObservation: (text: string, image?: Blob, observedAt?: string, snapshot?: VisionSnapshot) => void
  setVisionStatus: (status: VisionProcessingStatus, attemptedAt?: string, error?: string) => void
  clearLatestVisionObservation: (observedAt?: string) => void
  setVisionRequester: (requester?: () => void) => void
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
  latestVisionObservation: undefined,
  visionStatus: "idle",
  requestVisionObservation: undefined,
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
  setLatestVisionObservation: (text, image, observedAt = new Date().toISOString(), snapshot) => set({
    latestVisionObservation: { text, observedAt, image, snapshot },
    visionStatus: "ready",
    visionError: undefined,
  }),
  setVisionStatus: (visionStatus, visionLastAttemptAt, visionError) => set({ visionStatus, visionLastAttemptAt, visionError }),
  setVisionRequester: (requestVisionObservation) => set({ requestVisionObservation }),
  clearLatestVisionObservation: (observedAt) => set((state) =>
    !observedAt || state.latestVisionObservation?.observedAt === observedAt
      ? { latestVisionObservation: undefined, visionStatus: "idle", visionLastAttemptAt: undefined, visionError: undefined }
      : {},
  ),
  dismiss: (id) =>
    set((state) => ({
      observations: state.observations.filter((item) => item.id !== id),
    })),
}))
