"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Camera, Maximize2, Mic, Minimize2, Pause, Play, X } from "lucide-react"
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
    if (!isFullscreen) return

    const previousOverflow = document.body.style.overflow
    const fullscreenTrigger = fullscreenTriggerRef.current
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    const handleFullscreenKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false)
        return
      }

      if (event.key !== "Tab") return
      const dialog = document.querySelector<HTMLElement>(".rocky-fullscreen")
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", handleFullscreenKeys)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleFullscreenKeys)
      fullscreenTrigger?.focus()
    }
  }, [isFullscreen])

  const controls = (
    <>
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
    </>
  )

  return (
    <section className={`presence-panel presence-${state}`} aria-label="ROCKY companion controls">
      <div className="presence-topline">
        <span className="eyebrow"><span className="status-dot" /> YOUR COMPANION</span>
        <div className="presence-top-actions">
          <span className="demo-pill"><span /> UI DEMO</span>
          <button
            ref={fullscreenTriggerRef}
            type="button"
            className="icon-button fullscreen-trigger"
            onClick={() => setIsFullscreen(true)}
            aria-label="Open Rocky in fullscreen"
            title="Open fullscreen"
          >
            <Maximize2 size={15} />
          </button>
        </div>
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
        {controls}
      </div>
      <p className="presence-footnote">Microphone and camera are not connected in this demo.</p>
      {isFullscreen && createPortal(
        <div className={`rocky-fullscreen presence-${state}`} role="dialog" aria-modal="true" aria-label="ROCKY fullscreen companion">
          <header className="fullscreen-header">
            <span className="fullscreen-brand">rocky<span className="brand-period">.</span></span>
            <span className="fullscreen-status"><span className="status-dot" /> {stateLabels[state]}</span>
            <button
              ref={closeButtonRef}
              type="button"
              className="fullscreen-close"
              onClick={() => setIsFullscreen(false)}
              aria-label="Close fullscreen"
            >
              <Minimize2 size={16} />
              <span>Exit fullscreen</span>
              <X className="fullscreen-close-mobile" size={17} />
            </button>
          </header>
          <main className="fullscreen-content">
            <section className="fullscreen-presence" aria-label="ROCKY visual presence">
              <span className="eyebrow"><span className="status-dot" /> YOUR COMPANION</span>
              <div className="fullscreen-orb presence-orb" aria-hidden="true">
                <div className="orb-ring ring-one" />
                <div className="orb-ring ring-two" />
                <div className="orb-ring ring-three" />
                <div className="orb-core" />
              </div>
              <p className="presence-kicker">A little space to be</p>
              <h1>I’m here with you.</h1>
              <p className="fullscreen-state">{stateLabels[state]}</p>
              <div className="presence-controls fullscreen-controls">{controls}</div>
              <p className="presence-footnote">Microphone and camera are not connected in this demo.</p>
            </section>
          </main>
          <p className="fullscreen-demo-note">ROCKY UI DEMO · Sample replies only</p>
        </div>,
        document.body,
      )}
    </section>
  )
}
