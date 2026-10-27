"use client"

import { useSyncExternalStore } from "react"
import { CalendarDays, CloudSun, Coffee, ArrowRight, BookOpen } from "lucide-react"
import Link from "next/link"
import { RockyPresence } from "@/components/rocky/rocky-presence"
import { AwarenessCard } from "@/components/awareness/awareness-card"
import { ConversationPanel } from "@/components/chat/conversation-panel"
import { useSettingsStore } from "@/stores/settings-store"
import { Card } from "@/components/ui/card"

const subscribeToNothing = () => () => {}
const getGreeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}
const getTodayLabel = () =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date()).toUpperCase()

export default function Home() {
  const greeting = useSyncExternalStore(subscribeToNothing, getGreeting, () => "A moment for you")
  const todayLabel = useSyncExternalStore(subscribeToNothing, getTodayLabel, () => "YOUR SPACE TODAY")
  const personality = useSettingsStore((store) => store.personality)

  return (
    <div className="page home-page">
      <header className="page-header home-header">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1>{greeting}<span className="heading-period">.</span></h1>
          <p>A little space for whatever’s on your mind.</p>
        </div>
        <div className="header-personality"><span className="status-dot" /> {personality} companion</div>
      </header>
      <div className="home-grid">
        <div className="home-primary">
          <RockyPresence />
          <section className="context-section">
            <div className="section-heading context-heading">
              <div><span className="eyebrow">A LITTLE CONTEXT</span><h2>Here & now</h2></div>
              <span className="context-note">Thoughtful, not intrusive</span>
            </div>
            <div className="context-grid">
              <Card className="context-card gap-0 ring-0">
                <span className="context-icon"><CloudSun size={17} /></span>
                <span className="context-label">YOUR ENVIRONMENT</span>
                <strong>Quiet moment</strong>
                <span className="context-detail">No live sensing · demo only</span>
              </Card>
              <Card className="context-card gap-0 ring-0">
                <span className="context-icon"><BookOpen size={17} /></span>
                <span className="context-label">RECENT MEMORY</span>
                <strong>A gentle start</strong>
                <Link href="/memories" className="context-detail context-link">View sample memory <ArrowRight size={12} /></Link>
              </Card>
              <Card className="context-card gap-0 ring-0">
                <span className="context-icon"><CalendarDays size={17} /></span>
                <span className="context-label">YOUR DAY</span>
                <strong>Room to begin</strong>
                <span className="context-detail">Your calendar isn’t connected</span>
              </Card>
            </div>
          </section>
          <div className="awareness-section">
            <div className="section-heading compact-heading">
              <div><span className="eyebrow">A GENTLE NUDGE</span><h2>Something to consider</h2></div>
            </div>
            <AwarenessCard />
          </div>
        </div>
        <aside className="home-aside">
          <ConversationPanel />
          <Card className="privacy-note gap-0 ring-0">
            <span className="privacy-icon"><Coffee size={15} /></span>
            <p><strong>A note on this demo</strong><br />Companion awareness is a visual preview. Chat and memory use server services; push-to-talk audio is sent for transcription only after you stop recording.</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
