import { auth } from "@/lib/auth"
import { explainVisualObject } from "@/lib/meta-model-api"
import { createVisualActionPostHandler } from "@/lib/visual-intelligence-upload"

type NormalizedVisualBox = { xMin: number; yMin: number; xMax: number; yMax: number }

export const POST = createVisualActionPostHandler({
  getSession: (requestHeaders) => auth.api.getSession({ headers: requestHeaders }),
  logError: (entry) => console.error(JSON.stringify(entry)),
  perform: async ({ image, fields }) => {
    const objectId = fields.objectId?.trim() || ""
    const analysisRequestId = fields.analysisRequestId?.trim() || ""
    const label = fields.label?.trim() || ""
    if (!/^object-\d+$/.test(objectId) || !/^[0-9a-f-]{36}$/i.test(analysisRequestId) || !label || label.length > 200) {
      throw Object.assign(new Error("Invalid selected object."), { code: "invalid_object_box" })
    }
    let bbox: NormalizedVisualBox | null = null
    if (fields.bbox) {
      let parsed: unknown
      try {
        parsed = JSON.parse(fields.bbox)
      } catch {
        throw Object.assign(new Error("Invalid selected object box."), { code: "invalid_object_box" })
      }
      if (!parsed || typeof parsed !== "object") {
        throw Object.assign(new Error("Invalid selected object box."), { code: "invalid_object_box" })
      }
      const candidate = parsed as Record<string, unknown>
      const coordinates = [candidate.xMin, candidate.yMin, candidate.xMax, candidate.yMax]
      if (!coordinates.every((value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1000)
        || Number(candidate.xMin) >= Number(candidate.xMax) || Number(candidate.yMin) >= Number(candidate.yMax)) {
        throw Object.assign(new Error("Invalid selected object box."), { code: "invalid_object_box" })
      }
      bbox = candidate as unknown as NormalizedVisualBox
    }

    const explanation = await explainVisualObject(
      { bytes: image.bytes, mimeType: image.mimeType },
      { label, bbox, question: fields.question },
    )
    return {
      explanation: {
        requestId: explanation.requestId,
        model: explanation.model,
        analysisRequestId,
        objectId,
        answer: explanation.result.answer,
      },
    }
  },
})
