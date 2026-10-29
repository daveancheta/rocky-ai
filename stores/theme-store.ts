import { create } from "zustand"

export type Appearance = "light" | "dark" | "system"

type ThemeStore = {
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  appearance: "light",
  setAppearance: (appearance) => set({ appearance }),
}))
