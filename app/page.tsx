"use client"

import { useSyncExternalStore } from "react"
import { CompanionExperience } from "@/components/companion/companion-experience"

const subscribeToNothing = () => () => {}
const getGreeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

export default function Home() {
  const greeting = useSyncExternalStore(subscribeToNothing, getGreeting, () => "Welcome")
  return (
    <div className="page home-page companion-page">
      <CompanionExperience greeting={greeting} />
    </div>
  )
}
