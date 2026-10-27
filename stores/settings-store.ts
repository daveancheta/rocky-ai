import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type Appearance = "light" | "dark" | "system"
export type Personality = "Calm" | "Friendly" | "Playful" | "Supportive"

type SettingsStore = {
  appearance: Appearance
  personality: Personality
  voice: "Not connected"
  quietMode: boolean
  interruptions: "gentle" | "only_when_needed"
  memoryEnabled: boolean
  setAppearance: (appearance: Appearance) => void
  setPersonality: (personality: Personality) => void
  setQuietMode: (quietMode: boolean) => void
  setInterruptions: (interruptions: "gentle" | "only_when_needed") => void
  setMemoryEnabled: (memoryEnabled: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      appearance: "light",
      personality: "Calm",
      voice: "Not connected",
      quietMode: false,
      interruptions: "gentle",
      memoryEnabled: true,
      setAppearance: (appearance) => set({ appearance }),
      setPersonality: (personality) => set({ personality }),
      setQuietMode: (quietMode) => set({ quietMode }),
      setInterruptions: (interruptions) => set({ interruptions }),
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
    }),
    {
      name: "rocky-preferences",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        appearance: state.appearance,
        personality: state.personality,
        quietMode: state.quietMode,
        interruptions: state.interruptions,
        memoryEnabled: state.memoryEnabled,
        voice: state.voice,
      }),
    },
  ),
)
