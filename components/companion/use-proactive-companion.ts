"use client"

import { useCallback, useEffect, useRef } from "react"
import { evaluateProactiveEvent, type ProactiveEvaluationInput } from "@/lib/api/proactive"
import { useCompanionStore } from "@/stores/companion-store"
import { useSettingsStore } from "@/stores/settings-store"

type ObservationEvent = { trigger: "observation"; observation: { text: string; observedAt: string; confidence: number } }
type SessionStartEvent = { trigger: "session_start" }
type ProactiveEvent = ObservationEvent | SessionStartEvent

export function useProactiveCompanion() {
  const sessionNonceRef = useRef<string | undefined>(undefined)
  const activeRequestRef = useRef<AbortController | null>(null)
  const pendingObservationRef = useRef<ObservationEvent | null>(null)
  const evaluateRef = useRef<(event: ProactiveEvent) => Promise<void>>(async () => {})
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => useSettingsStore.subscribe((state, previous) => {
    if (previous.proactiveEnabled && !state.proactiveEnabled) {
      activeRequestRef.current?.abort()
      activeRequestRef.current = null
      pendingObservationRef.current = null
      useCompanionStore.getState().setProactiveMessage(undefined)
    }
    if ((previous.proactiveEnabled && !state.proactiveEnabled || previous.speakProactive && !state.speakProactive) &&
      utteranceRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
      if (useCompanionStore.getState().status === "speaking") useCompanionStore.getState().setStatus("ready")
    }
  }), [])

  const cancel = useCallback(() => {
    sessionNonceRef.current = undefined
    pendingObservationRef.current = null
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    if (utteranceRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
    }
    useCompanionStore.getState().setProactiveMessage(undefined)
  }, [])

  const start = useCallback(() => {
    sessionNonceRef.current = crypto.randomUUID()
  }, [])

  const evaluate = useCallback(async (event: ProactiveEvent) => {
    const nonce = sessionNonceRef.current
    if (!nonce || !useCompanionStore.getState().isActive || !useSettingsStore.getState().proactiveEnabled) return
    if (activeRequestRef.current) {
      if (event.trigger === "observation") pendingObservationRef.current = event
      return
    }

    const controller = new AbortController()
    activeRequestRef.current = controller
    const settings = useSettingsStore.getState()
    const input: ProactiveEvaluationInput = {
      sessionNonce: nonce,
      trigger: event.trigger,
      ...(event.trigger === "observation" ? { observation: event.observation } : {}),
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      preferences: {
        enabled: settings.proactiveEnabled,
        speak: settings.speakProactive,
        quietHoursEnabled: settings.quietHoursEnabled,
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
      },
    }
    try {
      const result = await evaluateProactiveEvent(input, controller.signal)
      const currentSettings = useSettingsStore.getState()
      const currentTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`
      const toMinutes = (value: string) => {
        const [hours, minutes] = value.split(":").map(Number)
        return hours * 60 + minutes
      }
      const time = toMinutes(currentTime)
      const from = toMinutes(currentSettings.quietHoursStart)
      const until = toMinutes(currentSettings.quietHoursEnd)
      const quietNow = currentSettings.quietHoursEnabled && from !== until &&
        (from < until ? time >= from && time < until : time >= from || time < until)
      if (
        controller.signal.aborted ||
        sessionNonceRef.current !== nonce ||
        !useCompanionStore.getState().isActive ||
        !currentSettings.proactiveEnabled ||
        quietNow ||
        result.decision !== "speak"
      ) return

      const message = { id: crypto.randomUUID(), text: result.message, createdAt: result.createdAt }
      useCompanionStore.getState().setProactiveMessage(message)

      const status = useCompanionStore.getState().status
      const maySpeak = result.speak && currentSettings.speakProactive && !["listening", "speaking"].includes(status)
      if (
        maySpeak &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window &&
        !window.speechSynthesis.speaking
      ) {
        const utterance = new SpeechSynthesisUtterance(message.text)
        utterance.lang = navigator.language
        utteranceRef.current = utterance
        utterance.onend = () => {
          if (utteranceRef.current !== utterance) return
          utteranceRef.current = null
          if (useCompanionStore.getState().isActive && useCompanionStore.getState().status === "speaking") {
            useCompanionStore.getState().setStatus("ready")
          }
        }
        utterance.onerror = () => {
          if (utteranceRef.current !== utterance) return
          utteranceRef.current = null
          if (useCompanionStore.getState().isActive && useCompanionStore.getState().status === "speaking") {
            useCompanionStore.getState().setStatus("ready")
          }
        }
        try {
          useCompanionStore.getState().setStatus("speaking")
          window.speechSynthesis.speak(utterance)
        } catch {
          utteranceRef.current = null
          useCompanionStore.getState().setStatus("ready")
        }
      }
    } catch {
      // A failed proactive check stays quiet and does not interrupt the session.
    } finally {
      if (activeRequestRef.current === controller) activeRequestRef.current = null
      const pending = pendingObservationRef.current
      pendingObservationRef.current = null
      if (pending && sessionNonceRef.current === nonce && useCompanionStore.getState().isActive) {
        void evaluateRef.current(pending)
      }
    }
  }, [])

  useEffect(() => {
    evaluateRef.current = evaluate
  }, [evaluate])

  const beginSession = useCallback(() => {
    start()
    void evaluate({ trigger: "session_start" })
  }, [evaluate, start])

  const observe = useCallback((observation: { text: string; observedAt: string; confidence: number }) => {
    void evaluate({ trigger: "observation", observation })
  }, [evaluate])

  useEffect(() => cancel, [cancel])

  return { beginSession, observe, cancel }
}
