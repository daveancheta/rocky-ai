export type SpeechOwner = "reply" | "proactive" | "test"

type SpeechOptions = {
  owner: SpeechOwner
  language?: string
  voiceURI?: string
  rate?: number
  onStart?: () => void
  onEnd?: (cancelled: boolean) => void
  onError?: () => void
}

let activeSpeech: {
  utterance: SpeechSynthesisUtterance
  owner: SpeechOwner
  onEnd?: SpeechOptions["onEnd"]
  onError?: SpeechOptions["onError"]
} | undefined

export function canUseSpeechSynthesis() {
  return typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
}

export function isCompanionSpeechActive() {
  return Boolean(activeSpeech)
}

export function speakCompanionText(text: string, options: SpeechOptions) {
  const normalized = text.trim()
  if (!normalized || !canUseSpeechSynthesis() || document.visibilityState === "hidden") return false
  if (activeSpeech || window.speechSynthesis.speaking || window.speechSynthesis.pending) return false

  const utterance = new window.SpeechSynthesisUtterance(normalized)
  utterance.lang = options.language ?? navigator.language
  utterance.rate = Math.min(2, Math.max(0.5, options.rate ?? 1))
  if (options.voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.voiceURI === options.voiceURI)
    if (voice) utterance.voice = voice
  }
  activeSpeech = { utterance, owner: options.owner, onEnd: options.onEnd, onError: options.onError }
  const finish = (cancelled: boolean, failed = false) => {
    if (activeSpeech?.utterance !== utterance) return
    const onEnd = activeSpeech.onEnd
    const onError = activeSpeech.onError
    activeSpeech = undefined
    if (failed) onError?.()
    else onEnd?.(cancelled)
  }
  utterance.onstart = () => {
    if (activeSpeech?.utterance === utterance) options.onStart?.()
  }
  utterance.onend = () => finish(false)
  utterance.onerror = () => finish(false, true)

  try {
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    activeSpeech = undefined
    options.onError?.()
    return false
  }
}

export function stopCompanionSpeech(owner?: SpeechOwner) {
  if (!canUseSpeechSynthesis()) return false
  if (owner && activeSpeech?.owner !== owner) return false
  const previous = activeSpeech
  activeSpeech = undefined
  window.speechSynthesis.cancel()
  previous?.onEnd?.(true)
  return Boolean(previous)
}
