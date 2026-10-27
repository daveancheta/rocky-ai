"use client"

import { useSyncExternalStore } from "react"
import { useSettingsStore } from "@/stores/settings-store"
import { CompanionExperience } from "@/components/companion/companion-experience"

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
      <CompanionExperience greeting={greeting} personality={personality} />
    </div>
  )
}
