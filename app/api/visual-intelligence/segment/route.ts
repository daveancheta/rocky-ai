import { auth } from "@/lib/auth"
import { decodeMaskToRaster, recordsOfKind, segmentImageInBox } from "@/lib/meta-model-api"
import { createVisualActionPostHandler } from "@/lib/visual-intelligence-upload"

function readSelection(fields: Record<string, string>) {
  const objectId = fields.objectId?.trim() || ""
  const analysisRequestId = fields.analysisRequestId?.trim() || ""
  let bbox: unknown
  try {
    bbox = JSON.parse(fields.bbox || "")
  } catch {
    bbox = null
  }
  if (!/^object-\d+$/.test(objectId) || !/^[0-9a-f-]{36}$/i.test(analysisRequestId)
    || !bbox || typeof bbox !== "object") {
    throw Object.assign(new Error("Invalid selected object."), { code: "invalid_object_box" })
  }
  const box = bbox as Record<string, unknown>
  const coordinates = [box.xMin, box.yMin, box.xMax, box.yMax]
  if (!coordinates.every((value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1000)
    || Number(box.xMin) >= Number(box.xMax) || Number(box.yMin) >= Number(box.yMax)) {
    throw Object.assign(new Error("Invalid selected object box."), { code: "invalid_object_box" })
  }
  return { objectId, analysisRequestId, bbox: box as { xMin: number; yMin: number; xMax: number; yMax: number } }
}

export const POST = createVisualActionPostHandler({
  getSession: (requestHeaders) => auth.api.getSession({ headers: requestHeaders }),
  logError: (entry) => console.error(JSON.stringify(entry)),
  perform: async ({ image, fields }) => {
    const selection = readSelection(fields)
    const segmentation = await segmentImageInBox(
      { bytes: image.bytes, mimeType: image.mimeType },
      { width: image.width, height: image.height, bbox: selection.bbox },
    )
    const mask = recordsOfKind(segmentation.result.records, "mask").find((record) => record.objectId === "1")
    if (!mask) {
      throw Object.assign(new Error("SAM returned no mask for the selected object."), { code: "object_not_found" })
    }
    const raster = decodeMaskToRaster(mask.mask)
    return {
      segmentation: {
        requestId: segmentation.requestId,
        model: segmentation.model,
        analysisRequestId: selection.analysisRequestId,
        objectId: selection.objectId,
        imageWidth: image.width,
        imageHeight: image.height,
        mask: {
          width: mask.mask.width,
          height: mask.mask.height,
          bounds: mask.bounds,
          dataBase64: Buffer.from(raster).toString("base64"),
        },
      },
    }
  },
})
