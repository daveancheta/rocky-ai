export type MessageRole = "user" | "assistant"

export type ChatMessage = {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  isDemo?: boolean
}

export type SendMessageInput = {
  message: string
  conversationId?: string
}

export type SendMessageResponse = {
  conversationId?: string
  message: ChatMessage
}
