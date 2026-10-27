"use client"

import { useEffect, useRef, type FormEvent } from "react"
import { ArrowUp, MessageCircle, Mic, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat-store"
import { MessageBubble } from "@/components/chat/message-bubble"

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
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, isSending, isLoadingHistory])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSending || isLoadingHistory) return
    const form = event.currentTarget
    const input = new FormData(form).get("message")
    if (typeof input !== "string" || !input.trim()) return
    void sendMessage(input)
    form.reset()
  }

  return (
    <section className="conversation-card">
      <div className="section-heading conversation-heading">
        <div>
          <span className="eyebrow">A THOUGHTFUL CONVERSATION</span>
          <h2>Let’s talk</h2>
        </div>
        <div className="conversation-controls">
          <label className="visually-hidden" htmlFor="conversation-select">Choose a conversation</label>
          <select
            id="conversation-select"
            className="conversation-select"
            value={conversationId ?? ""}
            onChange={(event) => {
              const selectedId = event.target.value
              if (selectedId) void selectConversation(selectedId)
              else startNewConversation()
            }}
            disabled={isLoadingHistory || isSending || conversations.length === 0}
          >
            <option value="">New conversation</option>
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
          <button
            className="new-chat-button"
            type="button"
            onClick={startNewConversation}
            disabled={isLoadingHistory || isSending}
            aria-label="Start a new conversation"
            title="Start a new conversation"
          >
            <Plus size={15} />
          </button>
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
          <button
            type="button"
            className="retry-button"
            onClick={() => {
              if (conversationId) void selectConversation(conversationId)
              else void loadHistory()
            }}
          >
            <RotateCcw size={13} /> Try again
          </button>
        </div>
      )}
      {error && (
        <div className="chat-error" role="alert">
          <span>{error}</span>
          {lastMessage && <button onClick={() => void retry()} className="retry-button"><RotateCcw size={13} /> Try again</button>}
        </div>
      )}
      <form className="composer" onSubmit={onSubmit}>
        <input
          aria-label="Message Rocky"
          name="message"
          placeholder="Write what’s on your mind…"
          maxLength={2000}
          autoComplete="off"
          disabled={isSending || isLoadingHistory}
        />
        <button className="composer-mic" type="button" aria-label="Voice input not available" title="Voice input is not connected">
          <Mic size={17} />
        </button>
        <Button className="send-button" type="submit" disabled={isSending || isLoadingHistory} aria-label="Send message">
          <ArrowUp size={18} />
        </Button>
      </form>
      <p className="composer-note">Chat history is saved for this browser.</p>
    </section>
  )
}
