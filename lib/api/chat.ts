import { apiRequest } from "@/lib/api/client"
import type { SendMessageInput, SendMessageResponse } from "@/types/chat"

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
