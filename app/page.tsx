"use client"

import { useSyncExternalStore } from "react"
import { Activity, Settings2 } from "lucide-react"
import Link from "next/link"
import { RockyPresence } from "@/components/rocky/rocky-presence"
import { VisualAwareness } from "@/components/awareness/visual-awareness"
import { ConversationPanel } from "@/components/chat/conversation-panel"
import { useSettingsStore } from "@/stores/settings-store"

const subscribeToNothing = () => () => {}
const getGreeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

export default function Home() {
  const greeting = useSyncExternalStore(subscribeToNothing, getGreeting, () => "Welcome")
  const personality = useSettingsStore((store) => store.personality)

  return (
    <div className="page home-page companion-page">
      <header className="page-header home-header">
        <div>
          <span className="eyebrow">YOUR COMPANION</span>
          <h1>{greeting}<span className="heading-period">.</span></h1>
          <p>A little space for whatever&apos;s on your mind.</p>
        </div>
        <Link href="/settings" className="header-personality" aria-label="Open companion settings">
          <Settings2 size={15} /> {personality} companion
        </Link>
      </header>

      <div className="companion-layout">
        <section className="companion-stage" aria-label="ROCKY companion">
          <RockyPresence />
          <div className="awareness-inline">
            <div className="awareness-inline-heading">
              <span><Activity size={14} /> AWARENESS</span>
              <span>Camera off until you choose to capture</span>
            </div>
            <VisualAwareness />
          </div>
        </section>
        <ConversationPanel />
      </div>
    </div>
  )
}
