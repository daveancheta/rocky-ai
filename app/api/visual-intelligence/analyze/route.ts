import { auth } from "@/lib/auth"
import { analyzeImage } from "@/lib/meta-model-api"
import { createVisualAnalysisPostHandler } from "@/lib/visual-intelligence-upload"

export const POST = createVisualAnalysisPostHandler({
  getSession: (requestHeaders) => auth.api.getSession({ headers: requestHeaders }),
  analyzeImage,
  logError: (entry) => console.error(JSON.stringify(entry)),
})
