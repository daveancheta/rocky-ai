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
  SendMessageInput,
} from "@/types/chat"
import { useSettingsStore } from "@/stores/settings-store"
import { useCompanionStore } from "@/stores/companion-store"
import { useAwarenessStore } from "@/stores/awareness-store"
import { analyzeVisionImage } from "@/lib/api/vision"
import { isUsableVisionObservation, isVisualAwarenessQuestion } from "@/lib/companion/vision-change"

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
  cancelCurrent: () => void
}

let activeRequest: AbortController | undefined

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
    const controller = new AbortController()
    activeRequest = controller
    const observationIsRelevant = isVisualAwarenessQuestion(trimmed)
    if (observationIsRelevant && useCompanionStore.getState().cameraActive) {
      const awareness = useAwarenessStore.getState()
      const usable = awareness.latestVisionObservation && isUsableVisionObservation(
        awareness.latestVisionObservation.snapshot,
        awareness.latestVisionObservation.observedAt,
      )
      if (!usable) {
        awareness.requestVisionObservation?.()
        const deadline = Date.now() + 12_000
        while (Date.now() < deadline && !controller.signal.aborted) {
          await new Promise((resolve) => window.setTimeout(resolve, 250))
          const current = useAwarenessStore.getState()
          const fresh = current.latestVisionObservation
          if (fresh && isUsableVisionObservation(fresh.snapshot, fresh.observedAt)) break
          if (current.visionStatus === "uncertain" || current.visionStatus === "error") break
        }
      }
    }
    if (controller.signal.aborted) throw new DOMException("Request cancelled.", "AbortError")
    const latestObservation = useAwarenessStore.getState().latestVisionObservation
    const observationIsUsable = Boolean(observationIsRelevant && latestObservation && isUsableVisionObservation(
      latestObservation.snapshot,
      latestObservation.observedAt,
    ))
    let observation: SendMessageInput["observation"] = latestObservation && observationIsUsable
      ? {
          text: latestObservation.text,
          observedAt: latestObservation.observedAt,
          confidence: latestObservation.snapshot?.confidence,
        }
      : undefined
    const awareness = useAwarenessStore.getState()
    let visualAvailability = observationIsRelevant && !observation
      ? !useSettingsStore.getState().cameraMonitoring
        ? "off" as const
        : !useCompanionStore.getState().cameraActive
          ? "inactive" as const
          : awareness.visionStatus === "uncertain"
          ? "uncertain" as const
          : awareness.visionStatus === "error"
            ? "error" as const
            : "waiting" as const
      : undefined
    let visualError = visualAvailability === "error" ? awareness.visionError : undefined
    const age = latestObservation ? Date.now() - Date.parse(latestObservation.observedAt) : Infinity
    const identityQuestion = /\b(?:recognize me|recognise me|do you know me|who am i|is that me)\b/i.test(trimmed)
    const targetedQuestion = !identityQuestion && /\b(face|smil\w*|frown\w*|expression|doing|holding|typing|reading|writing|see me|see my)\b/i.test(trimmed)
    if (
      observationIsRelevant && latestObservation?.image && age >= 0 && age < 3 * 60_000 &&
      (!observation || targetedQuestion)
    ) {
      try {
        const result = await analyzeVisionImage(
          latestObservation.image,
          "understanding",
          [
            "Answer the user's question using only what is visibly supported by this single still image.",
            "Be cautious. If the requested detail is unclear, say you cannot tell from this image. Do not identify people, infer feelings or sensitive attributes, or guess.",
            `User question: ${trimmed}`,
          ].join("\n\n"),
          controller.signal,
        )
        if (result.kind === "understanding" && result.text.trim()) {
          observation = {
            text: result.text.trim().slice(0, 1_200),
            observedAt: latestObservation.observedAt,
            confidence: latestObservation.snapshot?.confidence,
            targeted: true,
          }
          visualAvailability = undefined
        }
      } catch (error) {
        if (controller.signal.aborted) throw error
        visualAvailability = "error"
        visualError = error instanceof Error ? error.message.slice(0, 240) : "Targeted still-image analysis failed."
      }
    }
    const locationQuestion = trimmed.match(/\b(?:where is|where are|find|locate|can you see)\s+(?:my|the|a|an)?\s*([^?.!,]{2,60})/i)
    if (latestObservation?.image && observation && !observation.targeted && age >= 0 && age < 5 * 60_000 && locationQuestion?.[1]) {
      try {
        const target = locationQuestion[1].trim()
        const result = await analyzeVisionImage(latestObservation.image, "segmentation", target, controller.signal)
        if (result.kind === "segmentation") {
          const locations = result.boxes.map((box) => {
            const x = Math.round(((box.x1 + box.x2) / 2 / box.width) * 100)
            const y = Math.round(((box.y1 + box.y2) / 2 / box.height) * 100)
            return `around ${x}% from the left and ${y}% from the top of the frame`
          })
          observation = {
            ...observation!,
            text: `${observation!.text}\nSAM 3.1 search for “${target}”: ${locations.length ? locations.join("; ") : "no matching object region was returned"}. These are approximate image coordinates, not a room location.`,
          }
        }
      } catch {
        // Continue with the scene description if object segmentation is unavailable.
      }
    }
    const response = await sendChatMessage({
      message: trimmed,
      conversationId: state.conversationId,
      personality: useSettingsStore.getState().personality,
      observation,
      visualAvailability,
      visualError,
    }, controller.signal)
    if (activeRequest === controller) activeRequest = undefined
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
    if (activeRequest?.signal.aborted) {
      activeRequest = undefined
      useChatStore.setState((current) => {
        if (!appendUser) return { isSending: false, error: undefined, lastMessage: undefined }
        const index = current.messages.findLastIndex((message) => message.role === "user" && message.content === trimmed)
        return {
          messages: index < 0 ? current.messages : current.messages.filter((_, messageIndex) => messageIndex !== index),
          isSending: false,
          error: undefined,
          lastMessage: undefined,
        }
      })
      return
    }
    activeRequest = undefined
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
  cancelCurrent: () => {
    activeRequest?.abort()
  },
}))
