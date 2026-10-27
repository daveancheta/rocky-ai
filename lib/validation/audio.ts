const MAX_TRANSCRIPTION_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_TRANSCRIPTION_DURATION_MS = 120_000

export type WavValidationResult =
  | { success: true; durationMs: number }
  | { success: false; error: string }

function readAscii(view: DataView, offset: number, length: number): string {
  let value = ""
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index))
  }
  return value
}

export function validateTranscriptionWav(bytes: Uint8Array): WavValidationResult {
  if (bytes.byteLength < 44 || bytes.byteLength > MAX_TRANSCRIPTION_AUDIO_BYTES) {
    return { success: false, error: "Audio must be a valid WAV recording under 8 MB." }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    return { success: false, error: "Audio must be a valid WAV recording." }
  }

  const riffEnd = view.getUint32(4, true) + 8
  if (riffEnd !== bytes.byteLength) {
    return { success: false, error: "Audio must be a valid WAV recording." }
  }

  let format: {
    encoding: number
    channels: number
    sampleRate: number
    byteRate: number
    blockAlign: number
    bitsPerSample: number
  } | undefined
  let audioDataBytes: number | undefined
  let offset = 12

  while (offset + 8 <= riffEnd) {
    const chunkName = readAscii(view, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkSize
    if (chunkEnd > riffEnd) {
      return { success: false, error: "Audio must be a valid WAV recording." }
    }

    if (chunkName === "fmt " && chunkSize >= 16) {
      format = {
        encoding: view.getUint16(chunkStart, true),
        channels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        byteRate: view.getUint32(chunkStart + 8, true),
        blockAlign: view.getUint16(chunkStart + 12, true),
        bitsPerSample: view.getUint16(chunkStart + 14, true),
      }
    } else if (chunkName === "data") {
      audioDataBytes = chunkSize
    }

    offset = chunkEnd + (chunkSize % 2)
  }

  if (
    !format ||
    audioDataBytes === undefined ||
    format.encoding !== 1 ||
    format.channels !== 1 ||
    ![16_000, 24_000].includes(format.sampleRate) ||
    format.bitsPerSample !== 16 ||
    format.blockAlign !== 2 ||
    format.byteRate !== format.sampleRate * format.blockAlign ||
    audioDataBytes === 0 ||
    audioDataBytes % format.blockAlign !== 0
  ) {
    return {
      success: false,
      error: "Use mono 16-bit PCM WAV audio sampled at 16 kHz or 24 kHz.",
    }
  }

  const durationMs = (audioDataBytes / format.byteRate) * 1000
  if (durationMs > MAX_TRANSCRIPTION_DURATION_MS) {
    return { success: false, error: "Recordings must be two minutes or shorter." }
  }

  return { success: true, durationMs }
}
