import type { ChatMessage } from "@/types/chat"
import { Sparkles } from "lucide-react"

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`message-row ${message.role}`}>
      {message.role === "assistant" && (
        <span className="message-avatar"><Sparkles size={13} /></span>
      )}
      <div className="message-content">
        <p className="message-bubble">{message.content}</p>
        {message.isDemo && <span className="message-tag">SAMPLE</span>}
      </div>
    </div>
  )
}
