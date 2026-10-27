"use client"

import { Camera, CircleStop, Play, Sparkles, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCompanionStore } from "@/stores/companion-store"
import { useAwarenessStore } from "@/stores/awareness-store"
import { CompanionConversation } from "@/components/companion/companion-conversation"

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
  const proactiveMessage = useCompanionStore((store) => store.proactiveMessage)
  const setProactiveMessage = useCompanionStore((store) => store.setProactiveMessage)
  const visionStatus = useAwarenessStore((store) => store.visionStatus)
  const visionObservedAt = useAwarenessStore((store) => store.latestVisionObservation?.observedAt)
  const visionLastAttemptAt = useAwarenessStore((store) => store.visionLastAttemptAt)

  const visionStatusText = visionStatus === "capturing"
    ? "Capturing a still image"
    : visionStatus === "processing"
      ? "Checking the latest still image"
      : visionStatus === "uncertain"
        ? "Latest observation is uncertain"
        : visionStatus === "error"
          ? "Latest still-image check failed"
          : visionObservedAt
            ? `Last still image checked ${new Date(visionObservedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : visionLastAttemptAt
              ? `Last check attempted ${new Date(visionLastAttemptAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : undefined

  return (
    <Card className={`presence-panel presence-${status} gap-0 ring-0`} aria-label="ROCKY companion presence">
      <div className="presence-topline">
        <span className="eyebrow"><span className="status-dot" /> ROCKY IS HERE</span>
        <span className="presence-awareness-status" aria-live="polite">
          {isActive ? statusCopy[status] : statusCopy.ready}
          {isActive && (status === "listening" || status === "speaking") && <span className={`presence-sound-wave wave-${status}`} aria-hidden="true"><i /><i /><i /><i /></span>}
        </span>
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
          <p className="presence-state">{isActive ? "I’m here with you." : "Start a companion session whenever you’re ready."}</p>
        </div>
      </div>
      {isActive && <CompanionConversation />}
      {isActive && proactiveMessage && <div className="proactive-message" role="status" aria-live="polite">
        <Sparkles size={15} aria-hidden="true" />
        <p>{proactiveMessage.text}</p>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => setProactiveMessage(undefined)} aria-label="Dismiss Rocky’s check-in" title="Dismiss check-in"><X size={14} /></Button>
      </div>}
      <div className="presence-session-status" aria-live="polite">
        {cameraActive && <span><Camera size={13} /> Camera on · periodic still images</span>}
        {cameraActive && visionStatusText && <span aria-live="polite">{visionStatusText}</span>}
        {notice && <span className="session-notice" role="status">{notice}</span>}
      </div>
      <Button type="button" className="companion-session-button" onClick={onToggle} disabled={disabled} aria-pressed={isActive}>
        {isStarting ? <><CircleStop size={17} /> Cancel start</> : isActive ? <><CircleStop size={17} /> End companion</> : <><Play size={17} /> Start companion</>}
      </Button>
      <p className="presence-footnote">{isActive ? "Ending the session stops camera checks and proactive check-ins." : "Camera access follows your Settings consent and browser permission."}</p>
    </Card>
  )
}
