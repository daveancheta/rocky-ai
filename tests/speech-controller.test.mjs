import assert from "node:assert/strict"
import test, { afterEach } from "node:test"
import {
  canUseSpeechSynthesis,
  isCompanionSpeechActive,
  speakCompanionText,
  stopCompanionSpeech,
} from "../lib/voice/speech-controller.ts"

const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalNavigator = globalThis.navigator

function installSpeechMock() {
  class FakeUtterance {
    constructor(text) { this.text = text }
  }
  const speechSynthesis = {
    speaking: false,
    pending: false,
    lastUtterance: undefined,
    speak(utterance) { this.lastUtterance = utterance; this.pending = true },
    cancel() { this.speaking = false; this.pending = false },
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { speechSynthesis, SpeechSynthesisUtterance: FakeUtterance },
  })
  Object.defineProperty(globalThis, "document", { configurable: true, value: { visibilityState: "visible" } })
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { language: "en-US" } })
  return speechSynthesis
}

afterEach(() => {
  stopCompanionSpeech()
  if (originalWindow === undefined) delete globalThis.window
  else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow })
  if (originalDocument === undefined) delete globalThis.document
  else Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument })
  if (originalNavigator === undefined) delete globalThis.navigator
  else Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator })
})

test("speech controller detects unavailable browser speech output", () => {
  assert.equal(canUseSpeechSynthesis(), false)
  assert.equal(speakCompanionText("Hello", { owner: "reply" }), false)
})

test("speech output is exclusive, interruptible, and reports actual playback events", () => {
  const synthesis = installSpeechMock()
  let started = 0
  let ended
  assert.equal(speakCompanionText("Hello there", {
    owner: "reply",
    onStart: () => { started += 1 },
    onEnd: (cancelled) => { ended = cancelled },
  }), true)
  assert.equal(speakCompanionText("Another response", { owner: "proactive" }), false)
  assert.equal(isCompanionSpeechActive(), true)
  synthesis.lastUtterance.onstart()
  assert.equal(started, 1)
  assert.equal(stopCompanionSpeech("proactive"), false)
  assert.equal(stopCompanionSpeech("reply"), true)
  assert.equal(ended, true)
  assert.equal(isCompanionSpeechActive(), false)
})
