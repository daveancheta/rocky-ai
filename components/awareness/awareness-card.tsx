"use client"

import { ArrowUpRight, Lightbulb, X } from "lucide-react"
import { useAwarenessStore } from "@/stores/awareness-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function AwarenessCard() {
  const observation = useAwarenessStore((store) => store.observations[0])
  const dismiss = useAwarenessStore((store) => store.dismiss)

  if (!observation) return null

  return (
    <Card className="awareness-card gap-0 ring-0">
      <div className="awareness-icon"><Lightbulb size={17} strokeWidth={1.7} /></div>
      <div className="awareness-copy">
        <div className="awareness-meta">
          <span>{observation.category}</span>
          <Badge variant="outline" className="sample-label">SAMPLE</Badge>
        </div>
        <p>{observation.message}</p>
        <span className="awareness-time">{observation.time}</span>
      </div>
      <a className="awareness-action" href="/memories" aria-label="Explore memories">
        <ArrowUpRight size={16} />
      </a>
      <Button
        variant="ghost"
        size="icon-sm"
        className="icon-button dismiss-button"
        onClick={() => dismiss(observation.id)}
        aria-label="Dismiss sample suggestion"
      >
        <X size={15} />
      </Button>
    </Card>
  )
}
