"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Pause, Play, Square } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import type { ChatMessage } from "@/types/chat"

function subscribeToSpeechSupport() {
  return () => {}
}

function getSpeechSupport() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  )
}

function getServerSpeechSupport() {
  return false
}

let activeUtterance: SpeechSynthesisUtterance | null = null

export function MessageBubble({ message }: { message: ChatMessage }) {
  const speechSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupport,
    getServerSpeechSupport,
  )
  const [speechState, setSpeechState] = useState<"idle" | "speaking" | "paused">("idle")
  const [speechError, setSpeechError] = useState("")
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    return () => {
      const utterance = utteranceRef.current
      utteranceRef.current = null
      if (utterance && activeUtterance === utterance && "speechSynthesis" in window) {
        activeUtterance = null
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const playSpeech = () => {
    if (!speechSupported || message.role !== "assistant") return
    window.speechSynthesis.cancel()
    activeUtterance = null
    setSpeechError("")
    const utterance = new SpeechSynthesisUtterance(message.content)
    utterance.lang = navigator.language
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null
        setSpeechState("idle")
      }
    }
    utterance.onerror = () => {
      if (activeUtterance === utterance) activeUtterance = null
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null
        setSpeechState("idle")
        setSpeechError("Speech playback failed in this browser.")
      }
    }
    utteranceRef.current = utterance
    activeUtterance = utterance
    setSpeechState("speaking")
    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      utteranceRef.current = null
      activeUtterance = null
      setSpeechState("idle")
      setSpeechError("Speech playback failed in this browser.")
    }
  }

  const stopSpeech = () => {
    if (utteranceRef.current && activeUtterance === utteranceRef.current) {
      activeUtterance = null
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setSpeechState("idle")
  }

  return (
    <div className={`message-row ${message.role}`}>
      {message.role === "assistant" && (
        <span className="message-avatar" aria-label="Rocky">R</span>
      )}
      <div className="message-content">
        <div className="message-bubble">
          {message.role === "assistant" ? (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          ) : (
            <p>{message.content}</p>
          )}
        </div>
        {message.role === "assistant" && speechSupported && (
          <div className="message-speech-controls">
            <span>Browser voice · not Meta TTS</span>
            {speechState === "idle" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Read response aloud"
                title="Read response aloud"
                onClick={playSpeech}
              >
                <Play />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={speechState === "paused" ? "Resume speech" : "Pause speech"}
                  title={speechState === "paused" ? "Resume speech" : "Pause speech"}
                  onClick={() => {
                    if (speechState === "paused") {
                      window.speechSynthesis.resume()
                      setSpeechState("speaking")
                    } else {
                      window.speechSynthesis.pause()
                      setSpeechState("paused")
                    }
                  }}
                >
                  {speechState === "paused" ? <Play /> : <Pause />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Stop speech"
                  title="Stop speech"
                  onClick={stopSpeech}
                >
                  <Square />
                </Button>
              </>
            )}
          </div>
        )}
        {speechError && <p className="message-speech-error" role="alert">{speechError}</p>}
      </div>
    </div>
  )
}
