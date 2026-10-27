"use client"

import { Camera, Mic, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAwarenessStore } from "@/stores/awareness-store"
import { useRockyStore } from "@/stores/rocky-store"

const stateLabels = {
  idle: "Ready when you are",
  listening: "Listening · visual demo only",
  thinking: "Thinking · visual demo only",
  speaking: "Speaking · visual demo only",
  paused: "Paused · visual demo only",
}

export function RockyPresence() {
  const state = useRockyStore((store) => store.state)
  const setState = useRockyStore((store) => store.setState)
  const isEnabled = useAwarenessStore((store) => store.isEnabled)
  const setEnabled = useAwarenessStore((store) => store.setEnabled)

  const toggleMic = () => {
    const nextState = {
      idle: "listening",
      listening: "thinking",
      thinking: "speaking",
      speaking: "idle",
      paused: "listening",
    } as const
    setState(nextState[state])
  }

  return (
    <section className={`presence-panel presence-${state}`} aria-label="ROCKY companion controls">
      <div className="presence-topline">
        <span className="eyebrow"><span className="status-dot" /> YOUR COMPANION</span>
        <span className="demo-pill"><span /> UI DEMO</span>
      </div>
      <div className="presence-main">
        <div className="presence-orb" aria-hidden="true">
          <div className="orb-ring ring-one" />
          <div className="orb-ring ring-two" />
          <div className="orb-ring ring-three" />
          <div className="orb-core" />
        </div>
        <div className="presence-copy">
          <p className="presence-kicker">A little space to be</p>
          <h2>I’m here with you.</h2>
          <p className="presence-state">{stateLabels[state]}</p>
        </div>
      </div>
      <div className="presence-controls">
        <Button
          variant="outline"
          className="control-button"
          onClick={() => setEnabled(!isEnabled)}
          aria-pressed={isEnabled}
          aria-label="Toggle visual awareness preview"
        >
          <Camera size={16} />
          {isEnabled ? "Preview enabled" : "Awareness preview"}
        </Button>
        <Button
          className={`mic-button ${state !== "idle" && state !== "paused" ? "is-listening" : ""}`}
          onClick={toggleMic}
          aria-label="Preview the listening, thinking, and speaking visual states"
        >
          <Mic size={18} />
          <span>{state === "idle" || state === "paused" ? "Preview states" : "Next state"}</span>
        </Button>
        <Button
          variant="outline"
          className="control-button"
          onClick={() => setState(state === "paused" ? "idle" : "paused")}
          aria-label={state === "paused" ? "Resume visual state" : "Pause visual state"}
        >
          {state === "paused" ? <Play size={16} /> : <Pause size={16} />}
          {state === "paused" ? "Resume" : "Pause"}
        </Button>
      </div>
      <p className="presence-footnote">Microphone and camera are not connected in this demo.</p>
    </section>
  )
}
