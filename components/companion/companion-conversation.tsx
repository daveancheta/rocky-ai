"use client"

import { useCallback, useEffect, useRef } from "react"
import { LoaderCircle, Mic, VolumeX } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { useVoiceInput } from "@/components/chat/use-voice-input"
import { useChatStore } from "@/stores/chat-store"
import { useCompanionStore } from "@/stores/companion-store"
import { useSettingsStore } from "@/stores/settings-store"
import { speakCompanionText, stopCompanionSpeech } from "@/lib/voice/speech-controller"

export function CompanionConversation({ voiceReady }: { voiceReady: boolean }) {
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
  const speechVoiceURI = useSettingsStore((store) => store.speechVoiceURI)
  const speechRate = useSettingsStore((store) => store.speechRate)
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
    void submit(transcript)
  }, [submit])
  const autoListen = isActive && voiceReady && microphoneEnabled && !isSending && !isLoadingHistory && status !== "thinking" && status !== "speaking"
  const voice = useVoiceInput(onTranscript, autoListen)
  const voiceStatus = voice.status
  const voiceError = voice.error
  const cancelVoice = voice.cancel
  const startRecording = voice.startRecording

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
      voiceURI: speechVoiceURI,
      rate: speechRate,
      onStart: () => {
        if (useCompanionStore.getState().isActive) setStatus("speaking")
      },
      onEnd: () => {
        if (useCompanionStore.getState().isActive && useCompanionStore.getState().status === "speaking") {
          setStatus("ready")
        }
      },
      onError: () => {
        if (useCompanionStore.getState().isActive) {
          setStatus("ready")
          useCompanionStore.getState().setSessionNotice("Speech playback failed. Rocky's reply remains available on screen.")
        }
      },
    })
    if (!speechStarted) {
      // Keep the response visible as text when speech output is unsupported or occupied.
      if (document.visibilityState === "visible") {
        useCompanionStore.getState().setSessionNotice("Speech output is unavailable or busy. Rocky's reply is shown as text.")
      }
    }
  }, [chatError, isActive, isSending, latestReply, messages.length, setStatus, speakReplies, speechRate, speechVoiceURI])

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

  const voiceStatusCopy = voiceStatus === "requesting"
    ? "Connecting to your microphone…"
    : voiceStatus === "recording"
      ? "Listening automatically. Pause for 3 seconds when you’re done."
      : voiceStatus === "processing"
        ? "Finishing your thought…"
        : isSending
          ? "ROCKY is thinking"
          : isActive && isLoadingHistory
            ? "Opening your conversation…"
          : isActive && !voiceReady
            ? "Starting your companion…"
            : undefined

  return (
    <div className="companion-conversation" aria-label="Talk with Rocky">
      {isActive && latestReply && <div className="companion-reply" aria-live="polite"><span>ROCKY</span><div className="companion-latest-reply"><ReactMarkdown>{latestReply.content}</ReactMarkdown></div></div>}
      {isActive && (voiceError || chatError || historyError) && <div className="companion-conversation-error" role="alert">
        <span>{voiceError || chatError || "Conversation history is unavailable; you can still start a new conversation."}</span>
        {voiceError && voiceReady && microphoneEnabled && <Button type="button" variant="ghost" size="sm" onClick={() => void startRecording()}>Retry listening</Button>}
        {chatError && <Button type="button" variant="ghost" size="sm" onClick={() => {
          pendingReplyCountRef.current = useChatStore.getState().messages.length + 1
          setStatus("thinking")
          void retry()
        }}>Try again</Button>}
        {historyError && <Button type="button" variant="ghost" size="sm" onClick={() => void loadHistory()}>Retry history</Button>}
      </div>}
      {isActive && <div className="companion-listening-controls" role="status" aria-live="polite">
        {microphoneEnabled && status !== "speaking" && voiceStatusCopy && <div className={`companion-auto-listening ${voiceStatus === "recording" ? "is-listening" : ""}`}>
          {voiceStatus === "requesting" || voiceStatus === "processing" || isSending ? <LoaderCircle size={15} className="animate-spin" /> : <Mic size={15} />}
          <span>{voiceStatusCopy}</span>
          {voiceStatus === "recording" && <span className="auto-listening-wave" aria-hidden="true"><i /><i /><i /></span>}
        </div>}
        {status === "speaking" && <div className="companion-auto-listening is-speaking"><VolumeX size={15} /><span>ROCKY is speaking</span><Button type="button" variant="ghost" size="icon" className="companion-voice-button" onClick={() => stopCompanionSpeech()} aria-label="Stop Rocky speaking" title="Stop speaking"><VolumeX size={16} /></Button></div>}
        {!microphoneEnabled && <p className="companion-input-hint">Voice conversation is off.</p>}
      </div>}
    </div>
  )
}
