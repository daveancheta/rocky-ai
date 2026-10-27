const TARGET_SAMPLE_RATE = 16_000

export function encodeMonoPcmWav(
  chunks: Float32Array[],
  sourceSampleRate: number,
): Blob {
  const inputLength = chunks.reduce((total, chunk) => total + chunk.length, 0)
  if (!inputLength || !Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
    throw new Error("No audio was captured.")
  }

  const input = new Float32Array(inputLength)
  let inputOffset = 0
  for (const chunk of chunks) {
    input.set(chunk, inputOffset)
    inputOffset += chunk.length
  }

  const outputLength = Math.floor((inputLength * TARGET_SAMPLE_RATE) / sourceSampleRate)
  if (!outputLength) throw new Error("The recording was too short to transcribe.")

  const wav = new ArrayBuffer(44 + outputLength * 2)
  const view = new DataView(wav)
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeAscii(0, "RIFF")
  view.setUint32(4, wav.byteLength - 8, true)
  writeAscii(8, "WAVE")
  writeAscii(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, "data")
  view.setUint32(40, outputLength * 2, true)

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = (index * sourceSampleRate) / TARGET_SAMPLE_RATE
    const leftIndex = Math.floor(sourcePosition)
    const rightIndex = Math.min(leftIndex + 1, inputLength - 1)
    const fraction = sourcePosition - leftIndex
    const interpolated =
      input[leftIndex] * (1 - fraction) + input[rightIndex] * fraction
    const sample = Math.max(-1, Math.min(1, interpolated))
    view.setInt16(
      44 + index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    )
  }

  return new Blob([wav], { type: "audio/wav" })
}
