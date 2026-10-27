import { create } from "zustand"

export type CompanionStatus = "ready" | "listening" | "thinking" | "speaking" | "observing"
export type ProactiveMessage = { id: string; text: string; createdAt: string }

type CompanionStore = {
  isActive: boolean
  status: CompanionStatus
  cameraActive: boolean
  sessionNotice?: string
  proactiveMessage?: ProactiveMessage
  start: () => void
  end: () => void
  setStatus: (status: CompanionStatus) => void
  setCameraActive: (active: boolean) => void
  setSessionNotice: (notice?: string) => void
  setProactiveMessage: (message?: ProactiveMessage) => void
}

export const useCompanionStore = create<CompanionStore>((set) => ({
  isActive: false,
  status: "ready",
  cameraActive: false,
  sessionNotice: undefined,
  proactiveMessage: undefined,
  start: () => set({ isActive: true, status: "ready", sessionNotice: undefined, proactiveMessage: undefined }),
  end: () => set({
    isActive: false,
    status: "ready",
    cameraActive: false,
    sessionNotice: undefined,
    proactiveMessage: undefined,
  }),
  setStatus: (status) => set({ status }),
  setCameraActive: (cameraActive) => set({ cameraActive }),
  setSessionNotice: (sessionNotice) => set({ sessionNotice }),
  setProactiveMessage: (proactiveMessage) => set({ proactiveMessage }),
}))
