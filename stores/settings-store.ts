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
  proactiveEnabled: boolean
  speakProactive: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  setAppearance: (appearance: Appearance) => void
  setPersonality: (personality: Personality) => void
  setMicrophoneEnabled: (enabled: boolean) => void
  setMemoryEnabled: (memoryEnabled: boolean) => void
  setCameraMonitoring: (enabled: boolean) => void
  setProactiveEnabled: (enabled: boolean) => void
  setSpeakProactive: (enabled: boolean) => void
  setQuietHoursEnabled: (enabled: boolean) => void
  setQuietHoursStart: (time: string) => void
  setQuietHoursEnd: (time: string) => void
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
      proactiveEnabled: true,
      speakProactive: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      setAppearance: (appearance) => set({ appearance }),
      setPersonality: (personality) => set({ personality }),
      setMicrophoneEnabled: (microphoneEnabled) => set({ microphoneEnabled }),
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
      setCameraMonitoring: (cameraMonitoring) => set({ cameraMonitoring }),
      setProactiveEnabled: (proactiveEnabled) => set({ proactiveEnabled }),
      setSpeakProactive: (speakProactive) => set({ speakProactive }),
      setQuietHoursEnabled: (quietHoursEnabled) => set({ quietHoursEnabled }),
      setQuietHoursStart: (quietHoursStart) => set({ quietHoursStart }),
      setQuietHoursEnd: (quietHoursEnd) => set({ quietHoursEnd }),
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
        proactiveEnabled: state.proactiveEnabled,
        speakProactive: state.speakProactive,
        quietHoursEnabled: state.quietHoursEnabled,
        quietHoursStart: state.quietHoursStart,
        quietHoursEnd: state.quietHoursEnd,
        voice: state.voice,
      }),
    },
  ),
)
