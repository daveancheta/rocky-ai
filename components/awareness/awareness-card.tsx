"use client"

import { ArrowUpRight, Lightbulb, X } from "lucide-react"
import { useAwarenessStore } from "@/stores/awareness-store"

export function AwarenessCard() {
  const observation = useAwarenessStore((store) => store.observations[0])
  const dismiss = useAwarenessStore((store) => store.dismiss)

  if (!observation) return null

  return (
    <article className="awareness-card">
      <div className="awareness-icon"><Lightbulb size={17} strokeWidth={1.7} /></div>
      <div className="awareness-copy">
        <div className="awareness-meta">
          <span>{observation.category}</span>
          <span className="sample-label">SAMPLE</span>
        </div>
        <p>{observation.message}</p>
        <span className="awareness-time">{observation.time}</span>
      </div>
      <a className="awareness-action" href="/memories" aria-label="Explore memories">
        <ArrowUpRight size={16} />
      </a>
      <button
        className="icon-button dismiss-button"
        onClick={() => dismiss(observation.id)}
        aria-label="Dismiss sample suggestion"
      >
        <X size={15} />
      </button>
    </article>
  )
}
