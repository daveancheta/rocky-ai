"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowUp, Check, LoaderCircle, MessageCircle, Mic, Plus, RotateCcw, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useChatStore } from "@/stores/chat-store"
import { MessageBubble } from "@/components/chat/message-bubble"
import { useVoiceInput } from "@/components/chat/use-voice-input"
import { useCompanionStore } from "@/stores/companion-store"
import { useSettingsStore } from "@/stores/settings-store"

export function ConversationPanel() {
  const messages = useChatStore((store) => store.messages)
  const conversations = useChatStore((store) => store.conversations)
  const conversationId = useChatStore((store) => store.conversationId)
  const isLoadingHistory = useChatStore((store) => store.isLoadingHistory)
  const historyError = useChatStore((store) => store.historyError)
  const isSending = useChatStore((store) => store.isSending)
  const error = useChatStore((store) => store.error)
  const lastMessage = useChatStore((store) => store.lastMessage)
  const loadHistory = useChatStore((store) => store.loadHistory)
  const selectConversation = useChatStore((store) => store.selectConversation)
  const startNewConversation = useChatStore((store) => store.startNewConversation)
  const sendMessage = useChatStore((store) => store.sendMessage)
  const retry = useChatStore((store) => store.retry)
  const isCompanionActive = useCompanionStore((store) => store.isActive)
  const setCompanionStatus = useCompanionStore((store) => store.setStatus)
  const setSessionNotice = useCompanionStore((store) => store.setSessionNotice)
  const speakReplies = useSettingsStore((store) => store.speakReplies)
  const microphoneEnabled = useSettingsStore((store) => store.microphoneEnabled)
  const [draft, setDraft] = useState("")
  const submitTranscript = useCallback((transcript: string) => {
    setDraft("")
    void sendMessage(transcript)
  }, [sendMessage])
  const voice = useVoiceInput(submitTranscript)
  const cancelVoice = voice.cancel
  const endRef = useRef<HTMLDivElement>(null)
  const wasSendingRef = useRef(false)
  const previousAssistantIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, isSending, isLoadingHistory])

  useEffect(() => {
    if (!isCompanionActive) {
      cancelVoice()
      window.speechSynthesis?.cancel()
      return
    }
    if (voice.status === "recording") setCompanionStatus("listening")
    else if (voice.status === "processing" || isSending) setCompanionStatus("thinking")
    else if (["listening", "thinking"].includes(useCompanionStore.getState().status)) setCompanionStatus("ready")
  }, [cancelVoice, isCompanionActive, isSending, setCompanionStatus, voice.status])

  useEffect(() => {
    if (isSending) {
      wasSendingRef.current = true
      previousAssistantIdRef.current = messages.at(-1)?.role === "assistant" ? messages.at(-1)?.id : undefined
      return
    }
    if (!wasSendingRef.current) return
    wasSendingRef.current = false
    const answer = messages.at(-1)
    if (answer?.role !== "assistant" || answer.id === previousAssistantIdRef.current) return
    if (isCompanionActive && speakReplies && !window.speechSynthesis) {
      setSessionNotice("Spoken replies aren't supported in this browser. Text chat remains available.")
      return
    }
    if (!isCompanionActive || !speakReplies) {
      if (isCompanionActive && useCompanionStore.getState().status === "thinking") setCompanionStatus("ready")
      return
    }
    const speech = new SpeechSynthesisUtterance(answer.content)
    speech.onstart = () => setCompanionStatus("speaking")
    speech.onend = () => {
      if (useCompanionStore.getState().isActive) setCompanionStatus("ready")
    }
    speech.onerror = () => {
      if (useCompanionStore.getState().isActive) setCompanionStatus("ready")
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(speech)
  }, [isSending, isCompanionActive, messages, setCompanionStatus, setSessionNotice, speakReplies])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSending || isLoadingHistory || voice.status !== "idle" || !draft.trim()) return
    void sendMessage(draft)
    setDraft("")
    voice.clearTranscript()
  }

  const isVoiceBusy = voice.status !== "idle"
  const recordingTime = `${String(Math.floor(voice.recordingSeconds / 60)).padStart(2, "0")}:${String(voice.recordingSeconds % 60).padStart(2, "0")}`

  return (
    <Card role="region" aria-label="Conversation with Rocky" className="conversation-card gap-0 py-0 ring-0">
      <div className="section-heading conversation-heading">
        <div>
          <span className="eyebrow">A THOUGHTFUL CONVERSATION</span>
          <h2>Let’s talk</h2>
        </div>
        <div className="conversation-controls">
          <label className="visually-hidden" htmlFor="conversation-select">Choose a conversation</label>
          <Select
            value={conversationId ?? "new"}
            onValueChange={(selectedId) => {
              if (selectedId && selectedId !== "new") void selectConversation(selectedId)
              else startNewConversation()
            }}
            disabled={isLoadingHistory || isSending || isVoiceBusy || conversations.length === 0}
          >
            <SelectTrigger id="conversation-select" aria-label="Choose a conversation" className="conversation-select">
              <SelectValue>
                {conversationId
                  ? conversations.find((conversation) => conversation.id === conversationId)?.title ?? "Choose a conversation"
                  : "New conversation"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="new">New conversation</SelectItem>
              {conversations.map((conversation) => (
                <SelectItem key={conversation.id} value={conversation.id}>
                  {conversation.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="new-chat-button"
            type="button"
            onClick={startNewConversation}
            disabled={isLoadingHistory || isSending || isVoiceBusy}
            aria-label="Start a new conversation"
            title="Start a new conversation"
          >
            <Plus size={15} />
          </Button>
        </div>
      </div>
      <div className="message-list" aria-live="polite">
        {isLoadingHistory ? (
          <div className="chat-empty"><span className="loading-spinner" /><p>Loading your conversations…</p></div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-icon"><MessageCircle size={19} /></span>
            <p>Every conversation can start somewhere.</p>
            <span>Share what’s on your mind, or simply say hello.</span>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        {isSending && (
          <div className="message-row assistant">
            <span className="message-avatar" aria-label="Rocky">R</span>
            <div className="message-content"><p className="message-bubble typing-dots"><i /><i /><i /></p></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {historyError && (
        <div className="chat-history-error" role="alert">
          <span>{historyError}</span>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="retry-button"
            onClick={() => {
              if (conversationId) void selectConversation(conversationId)
              else void loadHistory()
            }}
          >
            <RotateCcw size={13} /> Try again
          </Button>
        </div>
      )}
      {error && (
        <div className="chat-error" role="alert">
          <span>{error}</span>
          {lastMessage && <Button variant="ghost" size="sm" onClick={() => void retry()} className="retry-button"><RotateCcw size={13} /> Try again</Button>}
        </div>
      )}
      {voice.status === "recording" && (
        <div className="voice-status" role="status" aria-live="polite">
          <span className="voice-recording-indicator" />
          Recording {recordingTime} · Up to 2 minutes
        </div>
      )}
      {voice.status === "requesting" && (
        <div className="voice-status" role="status" aria-live="polite">
          <LoaderCircle size={14} className="animate-spin" /> Requesting microphone access…
        </div>
      )}
      {voice.status === "processing" && (
        <div className="voice-status" role="status" aria-live="polite">
          <LoaderCircle size={14} className="animate-spin" /> Transcribing your recording…
        </div>
      )}
      {voice.transcript && voice.status === "idle" && (
        <div className="voice-status" role="status" aria-live="polite">
          <Check size={14} /> You said: “{voice.transcript}”
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="voice-dismiss"
            onClick={() => {
              voice.clearTranscript()
              setDraft("")
            }}
            aria-label="Discard transcript"
            title="Discard transcript"
          >
            <X size={14} />
          </Button>
        </div>
      )}
      {voice.error && (
        <div className="voice-error" role="alert">
          <span>{voice.error}</span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={voice.cancel} aria-label="Dismiss voice error">
            <X size={14} />
          </Button>
        </div>
      )}
      <form className="composer" onSubmit={onSubmit}>
        <Input
          className="h-auto border-0 bg-transparent px-0 py-0 text-[13px] shadow-none focus-visible:border-0 focus-visible:ring-0"
          aria-label="Message Rocky"
          name="message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write what’s on your mind…"
          maxLength={2000}
          autoComplete="off"
          disabled={isSending || isLoadingHistory || isVoiceBusy}
        />
        <Button
          variant="ghost"
          size="icon"
          className={`composer-mic ${voice.status === "recording" ? "is-listening" : ""}`}
          type="button"
          onClick={() => {
            if (!isCompanionActive) return
            if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel()
            if (voice.status === "recording") void voice.stopRecording()
            else if (voice.status === "idle") void voice.startRecording()
          }}
          disabled={!isCompanionActive || !microphoneEnabled || isSending || isLoadingHistory || voice.status === "requesting" || voice.status === "processing"}
          aria-label={voice.status === "recording" ? "Stop recording and send transcript" : voice.status === "processing" ? "Transcribing recording" : "Start push-to-talk recording"}
          title={voice.status === "recording" ? "Stop recording and send transcript" : microphoneEnabled ? "Start push to talk" : "Enable push-to-talk in Settings"}
        >
          {voice.status === "recording" ? <Square size={15} /> : voice.status === "requesting" || voice.status === "processing" ? <LoaderCircle size={16} className="animate-spin" /> : <Mic size={17} />}
        </Button>
        {isVoiceBusy && (
          <Button
            variant="ghost"
            size="icon"
            className="composer-mic"
            type="button"
            onClick={voice.cancel}
            aria-label="Cancel voice input"
            title="Cancel voice input"
          >
            <X size={16} />
          </Button>
        )}
        <Button className="send-button" type="submit" disabled={isSending || isLoadingHistory || isVoiceBusy || !draft.trim()} aria-label="Send message">
          <ArrowUp size={18} />
        </Button>
      </form>
      <p className="composer-note">Chat history is saved for this browser.</p>
    </Card>
  )
}
