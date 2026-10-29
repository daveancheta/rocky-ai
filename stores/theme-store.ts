import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type Appearance = "light" | "dark" | "system"

type ThemeStore = {
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
}

function isAppearance(value: unknown): value is Appearance {
  return value === "light" || value === "dark" || value === "system"
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      appearance: "light",
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      name: "rocky-appearance",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ appearance: state.appearance }),
      merge: (persistedState, currentState) => {
        const storedAppearance = (persistedState as Partial<ThemeStore> | undefined)?.appearance
        return {
          ...currentState,
          appearance: isAppearance(storedAppearance) ? storedAppearance : currentState.appearance,
        }
      },
    },
  ),
)
