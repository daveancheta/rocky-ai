export type MessageRole = "user" | "assistant"

export type ChatMessage = {
  id: string
  role: MessageRole
  content: string
  createdAt: string
}

export type SendMessageInput = {
  message: string
  conversationId?: string
  personality?: "Calm" | "Friendly" | "Playful" | "Supportive"
  observation?: { text: string; observedAt: string; confidence?: number; targeted?: boolean }
  visualAvailability?: "off" | "inactive" | "waiting" | "uncertain" | "error"
  visualError?: string
}

export type ConversationSummary = {
  id: string
  title: string
  updatedAt: string
}

export type ConversationHistory = ConversationSummary & {
  messages: ChatMessage[]
}

export type SendMessageResponse = {
  conversationId: string
  model: string
  userMessage: ChatMessage
  message: ChatMessage
}
