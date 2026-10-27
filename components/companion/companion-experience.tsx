"use client"

import { Maximize2, Minimize2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useAwarenessStore } from "@/stores/awareness-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useCompanionStore } from "@/stores/companion-store"
import { RockyPresence } from "@/components/rocky/rocky-presence"
import { VisionObserver } from "@/components/companion/vision-observer"
import { useProactiveCompanion } from "@/components/companion/use-proactive-companion"

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function CompanionExperience({ greeting }: { greeting: string }) {
  const experienceRef = useRef<HTMLElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionTokenRef = useRef(0)
  const isActive = useCompanionStore((store) => store.isActive)
  const startSession = useCompanionStore((store) => store.start)
  const endSession = useCompanionStore((store) => store.end)
  const setCameraActive = useCompanionStore((store) => store.setCameraActive)
  const setNotice = useCompanionStore((store) => store.setSessionNotice)
  const cameraMonitoring = useSettingsStore((store) => store.cameraMonitoring)
  const { beginSession, observe, cancel: cancelProactive } = useProactiveCompanion()

  const end = useCallback(() => {
    sessionTokenRef.current += 1
    cancelProactive()
    stopStream(streamRef.current)
    streamRef.current = null
    setStream(null)
    setCameraActive(false)
    endSession()
    useAwarenessStore.getState().clearLatestVisionObservation()
  }, [cancelProactive, endSession, setCameraActive])

  const stopUnavailableCamera = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
    setStream(null)
    setCameraActive(false)
    setNotice("The camera stream could not start, so camera monitoring was stopped.")
  }, [setCameraActive, setNotice])

  useEffect(() => {
    let active = true
    void Promise.resolve(useSettingsStore.persist.rehydrate()).finally(() => {
      if (active) setSettingsReady(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === experienceRef.current)
    document.addEventListener("fullscreenchange", syncFullscreen)
    return () => document.removeEventListener("fullscreenchange", syncFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    const experience = experienceRef.current
    if (!experience) return
    try {
      if (document.fullscreenElement === experience) await document.exitFullscreen()
      else await experience.requestFullscreen()
    } catch {
      setNotice("Full screen is unavailable in this browser.")
    }
  }

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
            ? "Camera permission was denied. Rocky can still run without camera awareness."
            : "Camera is unavailable. Rocky can still run without camera awareness.",
        )
      }
    } else {
      setNotice("Camera awareness is off for this session. You can enable it in Settings.")
    }
    if (sessionTokenRef.current === sessionToken && useCompanionStore.getState().isActive) {
      beginSession()
      setIsStarting(false)
    }
  }

  useEffect(() => () => {
    sessionTokenRef.current += 1
    cancelProactive()
    stopStream(streamRef.current)
    useCompanionStore.getState().end()
    useAwarenessStore.getState().clearLatestVisionObservation()
  }, [cancelProactive])

  return (
    <section ref={experienceRef} className="companion-experience" aria-label="ROCKY companion">
      <header className="page-header home-header companion-header">
        <div>
          <span className="eyebrow">YOUR COMPANION</span>
          <h1>{greeting}<span className="heading-period">.</span></h1>
          <p>A little space for whatever&apos;s on your mind.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="companion-fullscreen-button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}>
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span>{isFullscreen ? "Exit full screen" : "Full screen"}</span>
        </Button>
      </header>
      {stream && isActive && <VisionObserver stream={stream} onObservation={observe} onUnavailable={stopUnavailableCamera} />}
      <div className="companion-layout">
        <div className="companion-stage">
          <RockyPresence onToggle={() => void toggle()} isStarting={isStarting} disabled={!settingsReady} />
        </div>
      </div>
    </section>
  )
}
