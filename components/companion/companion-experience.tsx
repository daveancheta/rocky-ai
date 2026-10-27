"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useChatStore } from "@/stores/chat-store"
import { useAwarenessStore } from "@/stores/awareness-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useCompanionStore } from "@/stores/companion-store"
import { RockyPresence } from "@/components/rocky/rocky-presence"
import { VisionObserver } from "@/components/companion/vision-observer"

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function CompanionExperience({ greeting }: { greeting: string }) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionTokenRef = useRef(0)
  const isActive = useCompanionStore((store) => store.isActive)
  const startSession = useCompanionStore((store) => store.start)
  const endSession = useCompanionStore((store) => store.end)
  const setCameraActive = useCompanionStore((store) => store.setCameraActive)
  const setNotice = useCompanionStore((store) => store.setSessionNotice)
  const cameraMonitoring = useSettingsStore((store) => store.cameraMonitoring)

  const end = useCallback(() => {
    sessionTokenRef.current += 1
    useChatStore.getState().cancelCurrent()
    stopStream(streamRef.current)
    streamRef.current = null
    setStream(null)
    setCameraActive(false)
    endSession()
    useAwarenessStore.getState().clearLatestVisionObservation()
  }, [endSession, setCameraActive])

  useEffect(() => {
    let active = true
    void Promise.resolve(useSettingsStore.persist.rehydrate()).finally(() => {
      if (active) setSettingsReady(true)
    })
    return () => { active = false }
  }, [])

  const toggle = async () => {
    if (isActive) {
      end()
      setIsStarting(false)
      return
    }
    if (isStarting) return
    const sessionToken = ++sessionTokenRef.current
    setIsStarting(true)
    useAwarenessStore.getState().clearLatestVisionObservation()
    void useChatStore.getState().loadHistory()
    startSession()

    if (cameraMonitoring) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported")
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1_600 }, height: { ideal: 1_600 } },
        })
        if (sessionTokenRef.current !== sessionToken || !useCompanionStore.getState().isActive) {
          stopStream(nextStream)
          return
        }
        streamRef.current = nextStream
        setStream(nextStream)
        setCameraActive(true)
      } catch (error) {
        if (sessionTokenRef.current !== sessionToken || !useCompanionStore.getState().isActive) return
        setNotice(
          error instanceof Error && error.name === "NotAllowedError"
            ? "Camera permission was denied. Text and push-to-talk remain available."
            : "Camera is unavailable. Text and push-to-talk remain available.",
        )
      }
    } else {
      setNotice("Camera is off for this session. You can enable still-image checks in Settings.")
    }
    if (sessionTokenRef.current === sessionToken) setIsStarting(false)
  }

  useEffect(() => () => {
    sessionTokenRef.current += 1
    useChatStore.getState().cancelCurrent()
    stopStream(streamRef.current)
    useCompanionStore.getState().end()
    useAwarenessStore.getState().clearLatestVisionObservation()
  }, [])

  return (
    <section className="companion-experience" aria-label="ROCKY companion">
      <header className="page-header home-header companion-header">
        <div>
          <span className="eyebrow">YOUR COMPANION</span>
          <h1>{greeting}<span className="heading-period">.</span></h1>
          <p>A little space for whatever&apos;s on your mind.</p>
        </div>
      </header>
      {stream && isActive && <VisionObserver stream={stream} />}
      <div className="companion-layout">
        <div className="companion-stage">
          <RockyPresence onToggle={() => void toggle()} isStarting={isStarting} disabled={!settingsReady} />
        </div>
      </div>
    </section>
  )
}
