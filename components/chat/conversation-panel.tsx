"use client"

import { useEffect, useRef, type FormEvent } from "react"
import { ArrowUp, MessageCircle, Mic, Plus, RotateCcw } from "lucide-react"
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
            disabled={isLoadingHistory || isSending || conversations.length === 0}
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
            disabled={isLoadingHistory || isSending}
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
      <form className="composer" onSubmit={onSubmit}>
        <Input
          className="h-auto border-0 bg-transparent px-0 py-0 text-[13px] shadow-none focus-visible:border-0 focus-visible:ring-0"
          aria-label="Message Rocky"
          name="message"
          placeholder="Write what’s on your mind…"
          maxLength={2000}
          autoComplete="off"
          disabled={isSending || isLoadingHistory}
        />
        <Button variant="ghost" size="icon" className="composer-mic" type="button" aria-label="Voice input not available" title="Voice input is not connected">
          <Mic size={17} />
        </Button>
        <Button className="send-button" type="submit" disabled={isSending || isLoadingHistory} aria-label="Send message">
          <ArrowUp size={18} />
        </Button>
      </form>
      <p className="composer-note">Chat history is saved for this browser.</p>
    </Card>
  )
}
