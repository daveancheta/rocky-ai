"use client"

import { Camera, CircleStop, Mic, Play } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCompanionStore } from "@/stores/companion-store"
import { useSettingsStore } from "@/stores/settings-store"

const statusCopy = {
  ready: "Ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  observing: "Observing a still image",
}

export function RockyPresence({ onToggle, isStarting, disabled }: { onToggle: () => void; isStarting: boolean; disabled: boolean }) {
  const isActive = useCompanionStore((store) => store.isActive)
  const status = useCompanionStore((store) => store.status)
  const cameraActive = useCompanionStore((store) => store.cameraActive)
  const notice = useCompanionStore((store) => store.sessionNotice)
  const microphoneEnabled = useSettingsStore((store) => store.microphoneEnabled)

  return (
    <Card className={`presence-panel presence-${status} gap-0 ring-0`} aria-label="ROCKY companion presence">
      <div className="presence-topline">
        <span className="eyebrow"><span className="status-dot" /> ROCKY IS HERE</span>
        <span className="presence-awareness-status" aria-live="polite">{isActive ? statusCopy[status] : statusCopy.ready}</span>
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
          <h2>I&apos;m here with you.</h2>
          <p className="presence-state">{isActive ? "I'm here. What would you like to talk about?" : "Start a session and we can talk or type."}</p>
        </div>
      </div>
      <div className="presence-session-status" aria-live="polite">
        {cameraActive && <span><Camera size={13} /> Camera on · periodic still images</span>}
        {isActive && <span><Mic size={13} /> {status === "listening" ? "Microphone active · recording" : microphoneEnabled ? "Microphone off · push to talk when you choose" : "Push-to-talk is disabled in Settings"}</span>}
        {notice && <span className="session-notice" role="status">{notice}</span>}
      </div>
      <Button type="button" className="companion-session-button" onClick={onToggle} disabled={disabled} aria-pressed={isActive}>
        {isStarting ? <><CircleStop size={17} /> Cancel start</> : isActive ? <><CircleStop size={17} /> End companion</> : <><Play size={17} /> Start companion</>}
      </Button>
      <p className="presence-footnote">{isActive ? "Ending the session stops camera checks and spoken playback." : "Camera access follows your Settings consent and your browser permission."}</p>
    </Card>
  )
}
