import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type Appearance = "light" | "dark" | "system"
export type Personality = "Calm" | "Friendly" | "Playful" | "Supportive"

type SettingsStore = {
  appearance: Appearance
  personality: Personality
  voice: "Not connected"
  memoryEnabled: boolean
  cameraMonitoring: boolean
  microphoneEnabled: boolean
  speakReplies: boolean
  setAppearance: (appearance: Appearance) => void
  setPersonality: (personality: Personality) => void
  setMemoryEnabled: (memoryEnabled: boolean) => void
  setCameraMonitoring: (enabled: boolean) => void
  setMicrophoneEnabled: (enabled: boolean) => void
  setSpeakReplies: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      appearance: "light",
      personality: "Calm",
      voice: "Not connected",
      memoryEnabled: true,
      cameraMonitoring: false,
      microphoneEnabled: true,
      speakReplies: false,
      setAppearance: (appearance) => set({ appearance }),
      setPersonality: (personality) => set({ personality }),
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
      setCameraMonitoring: (cameraMonitoring) => set({ cameraMonitoring }),
      setMicrophoneEnabled: (microphoneEnabled) => set({ microphoneEnabled }),
      setSpeakReplies: (speakReplies) => set({ speakReplies }),
    }),
    {
      name: "rocky-preferences",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        appearance: state.appearance,
        personality: state.personality,
        memoryEnabled: state.memoryEnabled,
        cameraMonitoring: state.cameraMonitoring,
        microphoneEnabled: state.microphoneEnabled,
        speakReplies: state.speakReplies,
        voice: state.voice,
      }),
    },
  ),
)
