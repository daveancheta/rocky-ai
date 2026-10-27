import { create } from "zustand"

export type RockyState = "idle" | "listening" | "thinking" | "speaking" | "paused"

type RockyStore = {
  state: RockyState
  setState: (state: RockyState) => void
  toggleListening: () => void
}

export const useRockyStore = create<RockyStore>((set) => ({
  state: "idle",
  setState: (state) => set({ state }),
  toggleListening: () =>
    set((state) => ({
      state: state.state === "listening" ? "idle" : "listening",
    })),
}))
