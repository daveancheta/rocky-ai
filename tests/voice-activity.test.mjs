import assert from "node:assert/strict"
import test from "node:test"
import {
  hasUtteranceEnded,
  hasVoiceActivity,
  measureAudioRms,
  speechRmsThreshold,
  VOICE_SILENCE_END_MS,
} from "../lib/audio/voice-activity.ts"

test("RMS level measures silence and speech energy", () => {
  assert.equal(measureAudioRms(new Float32Array()), 0)
  assert.equal(measureAudioRms(new Float32Array([0, 0, 0])), 0)
  assert.equal(measureAudioRms(new Float32Array([0.5, -0.5])), 0.5)
})

test("voice activity threshold rises with the measured noise floor", () => {
  assert.equal(hasVoiceActivity(0.01, 0.002), true)
  assert.equal(hasVoiceActivity(0.01, 0.02), false)
  assert.equal(speechRmsThreshold(0.02), 0.025)
})

test("utterances end only after detected voice is followed by enough silence", () => {
  assert.equal(hasUtteranceEnded(false, 0, 10_000), false)
  assert.equal(hasUtteranceEnded(true, 10_000, 10_000 + VOICE_SILENCE_END_MS - 1), false)
  assert.equal(hasUtteranceEnded(true, 10_000, 10_000 + VOICE_SILENCE_END_MS), true)
})
