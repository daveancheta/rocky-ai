export const MAX_VISION_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_VISION_IMAGE_DIMENSION = 4_096
export const MAX_VISION_IMAGE_PIXELS = 16_000_000

export type SupportedVisionImageType = "image/jpeg" | "image/png"

export type ImageValidationResult =
  | {
      success: true
      width: number
      height: number
      contentType: SupportedVisionImageType
    }
  | { success: false; error: string }

function isPng(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  return signature.every((value, index) => bytes[index] === value)
}

function readPngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    !isPng(bytes) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  ) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  const supportedFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ])
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) return null

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1]
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null
    if (supportedFrameMarkers.has(marker)) {
      if (segmentLength < 7) return null
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      }
    }
    offset += segmentLength
  }
  return null
}

export function validateVisionImage(
  bytes: Uint8Array,
  declaredType: string,
): ImageValidationResult {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_VISION_IMAGE_BYTES) {
    return { success: false, error: "Choose an image smaller than 5 MB." }
  }

  const image = isPng(bytes)
    ? { ...readPngDimensions(bytes), contentType: "image/png" as const }
    : bytes[0] === 0xff && bytes[1] === 0xd8
      ? { ...readJpegDimensions(bytes), contentType: "image/jpeg" as const }
      : null
  if (!image?.width || !image.height) {
    return {
      success: false,
      error: "Use a valid JPEG or PNG image. Other image formats are not supported.",
    }
  }
  if (declaredType !== image.contentType) {
    return { success: false, error: "The image type does not match its file contents." }
  }
  if (
    image.width > MAX_VISION_IMAGE_DIMENSION ||
    image.height > MAX_VISION_IMAGE_DIMENSION ||
    image.width * image.height > MAX_VISION_IMAGE_PIXELS
  ) {
    return {
      success: false,
      error: "Images must be at most 4,096 pixels on either side and 16 megapixels total.",
    }
  }

  return {
    success: true,
    width: image.width,
    height: image.height,
    contentType: image.contentType,
  }
}
