"use client"

import { useEffect, useRef, type FormEvent } from "react"
import { ArrowUp, MessageCircle, Mic, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat-store"
import { MessageBubble } from "@/components/chat/message-bubble"

export function ConversationPanel() {
  const messages = useChatStore((store) => store.messages)
  const isSending = useChatStore((store) => store.isSending)
  const error = useChatStore((store) => store.error)
  const sendMessage = useChatStore((store) => store.sendMessage)
  const retry = useChatStore((store) => store.retry)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, isSending])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
        <span className="conversation-demo">Sample conversation</span>
      </div>
      <div className="message-list" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-sparkle"><MessageCircle size={19} /></span>
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
      {error && (
        <div className="chat-error" role="alert">
          <span>{error}</span>
          <button onClick={() => void retry()} className="retry-button"><RotateCcw size={13} /> Try again</button>
        </div>
      )}
      <form className="composer" onSubmit={onSubmit}>
        <input
          aria-label="Message Rocky"
          name="message"
          placeholder="Write what’s on your mind…"
          maxLength={2000}
          autoComplete="off"
        />
        <button className="composer-mic" type="button" aria-label="Voice input not available in demo" title="Voice input is not connected">
          <Mic size={17} />
        </button>
        <Button className="send-button" type="submit" disabled={isSending} aria-label="Send message">
          <ArrowUp size={18} />
        </Button>
      </form>
      <p className="composer-note">Your messages stay in this temporary local demo.</p>
    </section>
  )
}
