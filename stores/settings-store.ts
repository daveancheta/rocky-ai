import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type Appearance = "light" | "dark" | "system"
export type Personality = "Calm" | "Friendly" | "Playful" | "Supportive"
type SettingsStore = {
  appearance: Appearance
  personality: Personality
  microphoneEnabled: boolean
  voice: "Not connected"
  memoryEnabled: boolean
  cameraMonitoring: boolean
  setAppearance: (appearance: Appearance) => void
  setPersonality: (personality: Personality) => void
  setMicrophoneEnabled: (enabled: boolean) => void
  setMemoryEnabled: (memoryEnabled: boolean) => void
  setCameraMonitoring: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      appearance: "light",
      personality: "Calm",
      microphoneEnabled: true,
      voice: "Not connected",
      memoryEnabled: true,
      cameraMonitoring: false,
      setAppearance: (appearance) => set({ appearance }),
      setPersonality: (personality) => set({ personality }),
      setMicrophoneEnabled: (microphoneEnabled) => set({ microphoneEnabled }),
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
      setCameraMonitoring: (cameraMonitoring) => set({ cameraMonitoring }),
    }),
    {
      name: "rocky-preferences",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        appearance: state.appearance,
        personality: state.personality,
        microphoneEnabled: state.microphoneEnabled,
        memoryEnabled: state.memoryEnabled,
        cameraMonitoring: state.cameraMonitoring,
        voice: state.voice,
      }),
    },
  ),
)
