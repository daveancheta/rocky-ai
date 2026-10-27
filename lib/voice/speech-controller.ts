export type SpeechOwner = "reply" | "proactive"

type SpeechOptions = {
  owner: SpeechOwner
  language?: string
  onStart?: () => void
  onEnd?: (cancelled: boolean) => void
}

let activeSpeech: { utterance: SpeechSynthesisUtterance; owner: SpeechOwner; onEnd?: SpeechOptions["onEnd"] } | undefined

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
  activeSpeech = { utterance, owner: options.owner, onEnd: options.onEnd }
  const finish = (cancelled: boolean) => {
    if (activeSpeech?.utterance !== utterance) return
    const onEnd = activeSpeech.onEnd
    activeSpeech = undefined
    onEnd?.(cancelled)
  }
  utterance.onstart = () => {
    if (activeSpeech?.utterance === utterance) options.onStart?.()
  }
  utterance.onend = () => finish(false)
  utterance.onerror = () => finish(false)

  try {
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    activeSpeech = undefined
    options.onEnd?.(false)
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
