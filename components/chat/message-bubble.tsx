"use client"

import ReactMarkdown from "react-markdown"
import type { ChatMessage } from "@/types/chat"

export function MessageBubble({ message }: { message: ChatMessage }) {
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
      </div>
    </div>
  )
}
