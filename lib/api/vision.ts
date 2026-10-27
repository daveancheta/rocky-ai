import { apiRequest } from "@/lib/api/client"

export type VisionAnalysisResult =
  | { model: "muse-spark-1.3"; kind: "understanding"; text: string }
  | {
      model: "sam-3.1"
      kind: "segmentation"
      boxes: Array<{
        objectId: number
        x1: number
        y1: number
        x2: number
        y2: number
        width: number
        height: number
      }>
    }

export function analyzeVisionImage(
  image: Blob,
  task: "understanding" | "segmentation",
  prompt: string,
  signal?: AbortSignal,
) {
  const formData = new FormData()
  formData.append("image", image, "camera-capture.jpg")
  formData.append("task", task)
  formData.append("prompt", prompt)
  return apiRequest<VisionAnalysisResult>("/api/vision/analyze", {
    method: "POST",
    body: formData,
    signal,
  })
}
