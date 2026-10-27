import { create } from "zustand"

export type CompanionStatus = "ready" | "listening" | "thinking" | "speaking" | "observing"

type CompanionStore = {
  isActive: boolean
  status: CompanionStatus
  cameraActive: boolean
  sessionNotice?: string
  start: () => void
  end: () => void
  setStatus: (status: CompanionStatus) => void
  setCameraActive: (active: boolean) => void
  setSessionNotice: (notice?: string) => void
}

export const useCompanionStore = create<CompanionStore>((set) => ({
  isActive: false,
  status: "ready",
  cameraActive: false,
  sessionNotice: undefined,
  start: () => set({ isActive: true, status: "ready", sessionNotice: undefined }),
  end: () => set({
    isActive: false,
    status: "ready",
    cameraActive: false,
    sessionNotice: undefined,
  }),
  setStatus: (status) => set({ status }),
  setCameraActive: (cameraActive) => set({ cameraActive }),
  setSessionNotice: (sessionNotice) => set({ sessionNotice }),
}))
