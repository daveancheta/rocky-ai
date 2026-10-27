import type { ChatMessage } from "@/types/chat"

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`message-row ${message.role}`}>
      {message.role === "assistant" && (
        <span className="message-avatar" aria-label="Rocky">R</span>
      )}
      <div className="message-content">
        <p className="message-bubble">{message.content}</p>
        {message.isDemo && <span className="message-tag">SAMPLE</span>}
      </div>
    </div>
  )
}
