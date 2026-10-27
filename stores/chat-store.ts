import { create } from "zustand"
import { createDemoReply } from "@/lib/demo-chat"
import type { ChatMessage } from "@/types/chat"

type ChatStore = {
  messages: ChatMessage[]
  conversationId?: string
  isSending: boolean
  error?: string
  lastMessage?: string
  sendMessage: (content: string) => Promise<void>
  retry: () => Promise<void>
}

const demoMessages: ChatMessage[] = [
  {
    id: "welcome-demo",
    role: "assistant",
    content:
      "Hello, I’m Rocky. Think of me as a calm space to gather your thoughts and make a little room for what matters.",
    createdAt: "Today",
    isDemo: true,
  },
  {
    id: "question-demo",
    role: "user",
    content: "I have a lot on my mind today.",
    createdAt: "Today",
    isDemo: true,
  },
  {
    id: "reply-demo",
    role: "assistant",
    content:
      "We can take it one thing at a time. What feels most important to start with?",
    createdAt: "Today",
    isDemo: true,
  },
]

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: demoMessages,
  isSending: false,
  sendMessage: async (content) => {
    const trimmed = content.trim()
    if (!trimmed || get().isSending) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({
      messages: [...state.messages, userMessage],
      isSending: true,
      error: undefined,
      lastMessage: trimmed,
    }))

    try {
      await new Promise((resolve) => setTimeout(resolve, 650))
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: createDemoReply(trimmed),
        createdAt: new Date().toISOString(),
        isDemo: true,
      }
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isSending: false,
      }))
    } catch (error) {
      set({
        isSending: false,
        error: error instanceof Error ? error.message : "Something went wrong.",
      })
    }
  },
  retry: async () => {
    const message = get().lastMessage
    if (!message || get().isSending) return
    set({ isSending: true, error: undefined })
    try {
      await new Promise((resolve) => setTimeout(resolve, 650))
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: createDemoReply(message),
        createdAt: new Date().toISOString(),
        isDemo: true,
      }
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isSending: false,
      }))
    } catch (error) {
      set({
        isSending: false,
        error: error instanceof Error ? error.message : "Something went wrong.",
      })
    }
  },
}))
