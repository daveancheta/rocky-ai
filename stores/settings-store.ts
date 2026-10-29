import { create } from "zustand"

export type Appearance = "light" | "dark" | "system"
export type Personality = "Calm" | "Friendly" | "Playful" | "Supportive"

type SettingsStore = {
  appearance: Appearance
  personality: Personality
  microphoneEnabled: boolean
  cameraMonitoring: boolean
  proactiveEnabled: boolean
  speakProactive: boolean
  speakReplies: boolean
  speechVoiceURI: string
  speechRate: number
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  setPersonality: (personality: Personality) => void
  setMicrophoneEnabled: (enabled: boolean) => void
  setCameraMonitoring: (enabled: boolean) => void
  setProactiveEnabled: (enabled: boolean) => void
  setSpeakProactive: (enabled: boolean) => void
  setSpeakReplies: (enabled: boolean) => void
  setSpeechVoiceURI: (voiceURI: string) => void
  setSpeechRate: (rate: number) => void
  setQuietHoursEnabled: (enabled: boolean) => void
  setQuietHoursStart: (time: string) => void
  setQuietHoursEnd: (time: string) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  appearance: "light",
  personality: "Calm",
  microphoneEnabled: true,
  cameraMonitoring: false,
  proactiveEnabled: true,
  speakProactive: false,
  speakReplies: true,
  speechVoiceURI: "",
  speechRate: 1,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  setPersonality: (personality) => set({ personality }),
  setMicrophoneEnabled: (microphoneEnabled) => set({ microphoneEnabled }),
  setCameraMonitoring: (cameraMonitoring) => set({ cameraMonitoring }),
  setProactiveEnabled: (proactiveEnabled) => set({ proactiveEnabled }),
  setSpeakProactive: (speakProactive) => set({ speakProactive }),
  setSpeakReplies: (speakReplies) => set({ speakReplies }),
  setSpeechVoiceURI: (speechVoiceURI) => set({ speechVoiceURI }),
  setSpeechRate: (speechRate) => set({ speechRate }),
  setQuietHoursEnabled: (quietHoursEnabled) => set({ quietHoursEnabled }),
  setQuietHoursStart: (quietHoursStart) => set({ quietHoursStart }),
  setQuietHoursEnd: (quietHoursEnd) => set({ quietHoursEnd }),
}))
