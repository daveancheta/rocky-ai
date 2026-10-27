"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowUp, LoaderCircle, Mic, Square, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVoiceInput } from "@/components/chat/use-voice-input"
import { useChatStore } from "@/stores/chat-store"
import { useCompanionStore } from "@/stores/companion-store"
import { useSettingsStore } from "@/stores/settings-store"
import { speakCompanionText, stopCompanionSpeech } from "@/lib/voice/speech-controller"

export function CompanionConversation() {
  const isActive = useCompanionStore((store) => store.isActive)
  const status = useCompanionStore((store) => store.status)
  const setStatus = useCompanionStore((store) => store.setStatus)
  const messages = useChatStore((store) => store.messages)
  const hasLoadedHistory = useChatStore((store) => store.hasLoadedHistory)
  const historyError = useChatStore((store) => store.historyError)
  const isLoadingHistory = useChatStore((store) => store.isLoadingHistory)
  const isSending = useChatStore((store) => store.isSending)
  const chatError = useChatStore((store) => store.error)
  const loadHistory = useChatStore((store) => store.loadHistory)
  const sendMessage = useChatStore((store) => store.sendMessage)
  const retry = useChatStore((store) => store.retry)
  const cancelCurrent = useChatStore((store) => store.cancelCurrent)
  const microphoneEnabled = useSettingsStore((store) => store.microphoneEnabled)
  const speakReplies = useSettingsStore((store) => store.speakReplies)
  const [draft, setDraft] = useState("")
  const pendingReplyCountRef = useRef<number | null>(null)
  const latestReply = [...messages].reverse().find((message) => message.role === "assistant")

  const submit = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || !useCompanionStore.getState().isActive || useChatStore.getState().isSending) return
    pendingReplyCountRef.current = useChatStore.getState().messages.length + 2
    stopCompanionSpeech()
    setStatus("thinking")
    await sendMessage(content)
  }, [sendMessage, setStatus])

  const onTranscript = useCallback((transcript: string) => {
    setDraft("")
    void submit(transcript)
  }, [submit])
  const voice = useVoiceInput(onTranscript)
  const voiceStatus = voice.status
  const voiceError = voice.error
  const cancelVoice = voice.cancel
  const startRecording = voice.startRecording
  const stopRecording = voice.stopRecording

  useEffect(() => {
    if (isActive && !hasLoadedHistory && !historyError && !isLoadingHistory) void loadHistory()
  }, [hasLoadedHistory, historyError, isActive, isLoadingHistory, loadHistory])

  useEffect(() => {
    if (!isActive) {
      cancelVoice()
      pendingReplyCountRef.current = null
      stopCompanionSpeech()
      cancelCurrent()
      return
    }
    if (voiceStatus === "recording") setStatus("listening")
    else if (voiceStatus === "processing" || isSending) setStatus("thinking")
    else if (status === "observing" || status === "speaking") return
    else setStatus("ready")
  }, [cancelCurrent, cancelVoice, isActive, isSending, setStatus, status, voiceStatus])

  useEffect(() => {
    if (!speakReplies) stopCompanionSpeech("reply")
  }, [speakReplies])

  useEffect(() => {
    if (!microphoneEnabled && voiceStatus !== "idle") cancelVoice()
  }, [cancelVoice, microphoneEnabled, voiceStatus])

  useEffect(() => {
    const targetCount = pendingReplyCountRef.current
    if (targetCount === null || isSending) return
    if (chatError) {
      pendingReplyCountRef.current = null
      return
    }
    if (!isActive || messages.length < targetCount || latestReply?.role !== "assistant") return
    pendingReplyCountRef.current = null
    if (!speakReplies) return
    const speechStarted = speakCompanionText(latestReply.content, {
      owner: "reply",
      onStart: () => {
        if (useCompanionStore.getState().isActive) setStatus("speaking")
      },
      onEnd: () => {
        if (useCompanionStore.getState().isActive && useCompanionStore.getState().status === "speaking") {
          setStatus("ready")
        }
      },
    })
    if (!speechStarted) {
      // Keep the response visible as text when speech output is unsupported or occupied.
      if (document.visibilityState === "visible") {
        useCompanionStore.getState().setSessionNotice("Speech output is unavailable or busy. Rocky's reply is shown as text.")
      }
    }
  }, [chatError, isActive, isSending, latestReply, messages.length, setStatus, speakReplies])

  useEffect(() => {
    if (!isActive) return
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return
      cancelVoice()
      stopCompanionSpeech()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [cancelVoice, isActive])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.trim() || isSending || isLoadingHistory || voiceStatus !== "idle") return
    const content = draft
    setDraft("")
    void submit(content)
  }

  const busy = isSending || voiceStatus === "processing" || voiceStatus === "requesting"
  const voiceStatusCopy = voiceStatus === "requesting"
    ? "Waiting for microphone permission"
    : voiceStatus === "recording"
      ? "Listening. Tap the microphone again to send."
      : voiceStatus === "processing"
        ? "Processing your speech"
        : isSending
          ? "Rocky is thinking"
          : undefined

  return (
    <div className="companion-conversation" aria-label="Talk with Rocky">
      {isActive && latestReply && <p className="companion-latest-reply" aria-live="polite">{latestReply.content}</p>}
      {isActive && voiceStatusCopy && <p className="companion-voice-status" role="status" aria-live="polite">{voiceStatusCopy}</p>}
      {isActive && (voiceError || chatError || historyError) && <div className="companion-conversation-error" role="alert">
        <span>{voiceError || chatError || "Conversation history is unavailable; you can still start a new conversation."}</span>
        {chatError && <Button type="button" variant="ghost" size="sm" onClick={() => {
          pendingReplyCountRef.current = useChatStore.getState().messages.length + 1
          setStatus("thinking")
          void retry()
        }}>Try again</Button>}
        {historyError && <Button type="button" variant="ghost" size="sm" onClick={() => void loadHistory()}>Retry history</Button>}
      </div>}
      <form className="companion-composer" onSubmit={onSubmit}>
        <Input
          className="companion-message-input"
          aria-label="Type a message to Rocky"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={isActive ? "Talk or type to Rocky…" : "Start companion mode to talk"}
          maxLength={2_000}
          autoComplete="off"
          disabled={!isActive || busy || isLoadingHistory || voiceStatus === "recording"}
        />
        {status === "speaking" && <Button type="button" variant="ghost" size="icon" className="companion-voice-button" onClick={() => stopCompanionSpeech()} aria-label="Stop Rocky speaking" title="Stop speaking"><VolumeX size={17} /></Button>}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`companion-voice-button ${voiceStatus === "recording" ? "is-listening" : ""}`}
          onClick={() => {
            if (voiceStatus === "recording") void stopRecording()
            else if (voiceStatus === "idle" && !busy && !isLoadingHistory) void startRecording()
          }}
          disabled={!isActive || !microphoneEnabled || busy || isLoadingHistory || (voiceStatus !== "idle" && voiceStatus !== "recording")}
          aria-label={voiceStatus === "recording" ? "Stop recording and send" : "Start push-to-talk"}
          title={microphoneEnabled ? "Push to talk" : "Enable microphone in Settings"}
        >
          {voiceStatus === "recording" ? <Square size={15} /> : voiceStatus === "requesting" || voiceStatus === "processing" ? <LoaderCircle size={16} className="animate-spin" /> : <Mic size={17} />}
        </Button>
        <Button type="submit" className="companion-send-button" disabled={!isActive || busy || isLoadingHistory || voiceStatus !== "idle" || !draft.trim()} aria-label="Send message to Rocky" title="Send message">
          {busy && !isSending ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={17} />}
        </Button>
      </form>
      {isActive && !microphoneEnabled && <p className="companion-input-hint">Push-to-talk is off in Settings. You can still type here.</p>}
    </div>
  )
}
