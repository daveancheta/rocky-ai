"use client"

import { useAwarenessStore } from "@/stores/awareness-store"
import { Card } from "@/components/ui/card"

export function RockyPresence() {
  const observation = useAwarenessStore((store) => store.latestVisionObservation)

  return (
    <Card className="presence-panel presence-idle gap-0 ring-0" aria-label="ROCKY companion presence">
      <div className="presence-topline">
        <span className="eyebrow"><span className="status-dot" /> ROCKY IS HERE</span>
        <span className="presence-awareness-status">{observation ? "Still image analyzed" : "Ready when you are"}</span>
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
          <p className="presence-state">Write a message or use push to talk below.</p>
        </div>
      </div>
      <p className="presence-footnote">Camera and microphone stay off until you choose to use them.</p>
    </Card>
  )
}
