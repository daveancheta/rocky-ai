import { apiRequest } from "@/lib/api/client"
import type {
  ConversationHistory,
  ConversationSummary,
  SendMessageInput,
  SendMessageResponse,
} from "@/types/chat"

export function sendChatMessage(
  input: SendMessageInput,
  signal?: AbortSignal,
) {
  return apiRequest<SendMessageResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  })
}

export function getConversations(signal?: AbortSignal) {
  return apiRequest<{ conversations: ConversationSummary[] }>("/api/chat", {
    method: "GET",
    signal,
  })
}

export function getConversation(
  conversationId: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ conversationId })
  return apiRequest<ConversationHistory>(`/api/chat?${query}`, {
    method: "GET",
    signal,
  })
}
