"use client"

import { create } from "zustand"
import {
  getConversation,
  getConversations,
  sendChatMessage,
} from "@/lib/api/chat"
import type {
  ChatMessage,
  ConversationSummary,
} from "@/types/chat"

type ChatStore = {
  messages: ChatMessage[]
  conversations: ConversationSummary[]
  conversationId?: string
  isLoadingHistory: boolean
  hasLoadedHistory: boolean
  historyError?: string
  isSending: boolean
  error?: string
  lastMessage?: string
  loadHistory: () => Promise<void>
  selectConversation: (conversationId: string) => Promise<void>
  startNewConversation: () => void
  sendMessage: (content: string) => Promise<void>
  retry: () => Promise<void>
}

async function submitMessage(content: string, appendUser: boolean) {
  const state = useChatStore.getState()
  if (state.isSending || state.isLoadingHistory) return

  const trimmed = content.trim()
  if (!trimmed) return

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: trimmed,
    createdAt: new Date().toISOString(),
  }
  useChatStore.setState((current) => ({
    messages: appendUser ? [...current.messages, userMessage] : current.messages,
    isSending: true,
    error: undefined,
    lastMessage: trimmed,
  }))

  try {
    const response = await sendChatMessage({
      message: trimmed,
      conversationId: state.conversationId,
    })
    const updatedAt = response.message.createdAt
    const summary: ConversationSummary = {
      id: response.conversationId,
      title: trimmed.length > 77 ? `${trimmed.slice(0, 77)}…` : trimmed,
      updatedAt,
    }

    useChatStore.setState((current) => {
      const conversations = [
        summary,
        ...current.conversations.filter(
          (conversation) => conversation.id !== response.conversationId,
        ),
      ].sort((first, second) =>
        second.updatedAt.localeCompare(first.updatedAt),
      )
      const lastUserMessageIndex = current.messages.findLastIndex(
        (message) => message.role === "user" && message.content === trimmed,
      )
      const messages = [...current.messages]
      if (lastUserMessageIndex >= 0) {
        messages[lastUserMessageIndex] = response.userMessage
      }

      return {
        messages: [...messages, response.message],
        conversations,
        conversationId: response.conversationId,
        isSending: false,
        error: undefined,
        lastMessage: undefined,
      }
    })
  } catch (error) {
    useChatStore.setState({
      isSending: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    })
  }
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  conversations: [],
  isLoadingHistory: false,
  hasLoadedHistory: false,
  isSending: false,
  loadHistory: async () => {
    if (get().isLoadingHistory || get().hasLoadedHistory) return
    set({ isLoadingHistory: true, historyError: undefined })

    try {
      const { conversations } = await getConversations()
      const previousSelection = get().conversationId
      const selectedId =
        conversations.find((item) => item.id === previousSelection)?.id ??
        conversations[0]?.id

      if (!selectedId) {
        set({
          conversations,
          conversationId: undefined,
          messages: [],
          hasLoadedHistory: true,
          isLoadingHistory: false,
        })
        return
      }

      const selectedConversation = await getConversation(selectedId)
      set({
        conversations,
        conversationId: selectedId,
        messages: selectedConversation.messages,
        hasLoadedHistory: true,
        isLoadingHistory: false,
      })
    } catch (error) {
      set({
        historyError:
          error instanceof Error
            ? error.message
            : "Conversation history is unavailable.",
        isLoadingHistory: false,
      })
    }
  },
  selectConversation: async (conversationId) => {
    if (
      get().isSending ||
      get().isLoadingHistory ||
      (get().conversationId === conversationId && !get().historyError)
    ) {
      return
    }
    set({
      conversationId,
      messages: [],
      isLoadingHistory: true,
      historyError: undefined,
      error: undefined,
    })
    try {
      const conversation = await getConversation(conversationId)
      set({
        messages: conversation.messages,
        isLoadingHistory: false,
        hasLoadedHistory: true,
      })
    } catch (error) {
      set({
        historyError:
          error instanceof Error
            ? error.message
            : "Conversation history is unavailable.",
        isLoadingHistory: false,
      })
    }
  },
  startNewConversation: () => {
    if (get().isSending || get().isLoadingHistory) return
    set({
      messages: [],
      conversationId: undefined,
      error: undefined,
      historyError: undefined,
      lastMessage: undefined,
      hasLoadedHistory: true,
    })
  },
  sendMessage: (content) => submitMessage(content, true),
  retry: () => {
    const message = get().lastMessage
    if (!message) return Promise.resolve()
    return submitMessage(message, false)
  },
}))
