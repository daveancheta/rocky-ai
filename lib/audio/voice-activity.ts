export const VOICE_SILENCE_END_MS = 3_000

const MIN_SPEECH_RMS = 0.008
const NOISE_MULTIPLIER = 2.5
const NOISE_MARGIN = 0.004
const MAX_SPEECH_THRESHOLD = 0.025

export function measureAudioRms(samples: Float32Array) {
  if (samples.length === 0) return 0
  let sumSquares = 0
  for (const sample of samples) sumSquares += sample * sample
  return Math.sqrt(sumSquares / samples.length)
}

export function speechRmsThreshold(noiseFloor: number) {
  return Math.min(MAX_SPEECH_THRESHOLD, Math.max(MIN_SPEECH_RMS, noiseFloor * NOISE_MULTIPLIER + NOISE_MARGIN))
}

export function hasVoiceActivity(rms: number, noiseFloor: number) {
  return rms >= speechRmsThreshold(noiseFloor)
}

export function hasUtteranceEnded(hasSpeech: boolean, lastVoiceAt: number, now: number) {
  return hasSpeech && now - lastVoiceAt >= VOICE_SILENCE_END_MS
}
