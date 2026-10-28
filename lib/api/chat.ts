import { apiRequest, ApiError } from "@/lib/api/client"
import type {
  ConversationHistory,
  ConversationSummary,
  SendMessageInput,
  SendMessageResponse,
} from "@/types/chat"

export function sendChatMessage(
  input: SendMessageInput,
  signal?: AbortSignal,
  onDelta?: (delta: string) => void,
) {
  if (onDelta) return sendStreamingChatMessage(input, signal, onDelta)
  return apiRequest<SendMessageResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  })
}

async function sendStreamingChatMessage(input: SendMessageInput, signal: AbortSignal | undefined, onDelta: (delta: string) => void) {
  let response: Response
  try {
    response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new ApiError("Unable to reach ROCKY right now. Please try again.", 0)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(body?.error ?? "The request could not be completed.", response.status)
  }
  if (!response.body) throw new ApiError("The server returned an empty response.", response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === "delta" && typeof event.delta === "string") onDelta(event.delta)
        if (event.type === "error") throw new ApiError(event.error, response.status)
        if (event.type === "done") return event.response as SendMessageResponse
      }
      if (done) break
    }
  } finally { reader.releaseLock() }
  throw new ApiError("The response stream ended unexpectedly. Please try again.", response.status)
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
