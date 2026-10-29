export type PublicInformationCategory = "object" | "animal" | "plant" | "landmark" | "product" | "person" | "other"

export interface PublicInformationQuery {
  category: PublicInformationCategory
  subject: string
  personName?: string
  focus?: string
}

export interface PublicInformationSource {
  title: string
  publisher: string
  url: string
  snippet?: string
  citationStatus: "cited_in_summary" | "search_result_only"
  retrievedAt: string
}

export interface PublicInformationResult {
  status: "results" | "no_results" | "ambiguous" | "unavailable"
  title: string
  summary: string
  searched: boolean
  sources: PublicInformationSource[]
  retrievedAt: string
  clarificationQuestion?: string
}

export interface PublicInformationProviderResponse {
  requestId: string
  model: string
  result: PublicInformationResult
}

export interface PublicInformationSearchProvider {
  search(query: PublicInformationQuery): Promise<PublicInformationProviderResponse>
}

export interface PublicInformationHandlerDependencies {
  getSession: (headers: Headers) => Promise<unknown | null>
  provider: PublicInformationSearchProvider
  logError?: (entry: Record<string, unknown>) => void
}

const categories: PublicInformationCategory[] = ["object", "animal", "plant", "landmark", "product", "person", "other"]

class PublicInformationBodyTooLarge extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new SyntaxError("Missing request body")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 8_192) {
      await reader.cancel()
      throw new PublicInformationBodyTooLarge()
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

export function createPublicInformationSearchHandler(dependencies: PublicInformationHandlerDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID()
    try {
      const origin = request.headers.get("origin")
      if (origin) {
        try {
          if (new URL(origin).host !== new URL(request.url).host) {
            return Response.json({ success: false, code: "invalid_origin", message: "This request could not be verified. Refresh Rocky and try again." }, { status: 403 })
          }
        } catch {
          return Response.json({ success: false, code: "invalid_origin", message: "This request could not be verified. Refresh Rocky and try again." }, { status: 403 })
        }
      }

      const session = await dependencies.getSession(request.headers)
      if (!session) {
        return Response.json({ success: false, code: "unauthenticated", message: "Sign in to find public information." }, { status: 401 })
      }
      const contentLength = Number(request.headers.get("content-length"))
      if (Number.isFinite(contentLength) && contentLength > 8_192) {
        return Response.json({ success: false, code: "request_too_large", message: "Keep the search details under 8 KB." }, { status: 413 })
      }
      if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        return Response.json({ success: false, code: "invalid_content_type", message: "Send the search details as JSON." }, { status: 415 })
      }

      let payload: unknown
      try {
        payload = await readBoundedJson(request)
      } catch (error) {
        if (error instanceof PublicInformationBodyTooLarge) {
          return Response.json({ success: false, code: "request_too_large", message: "Keep the search details under 8 KB." }, { status: 413 })
        }
        return Response.json({ success: false, code: "invalid_json", message: "The search details could not be read." }, { status: 400 })
      }
      if (!payload || typeof payload !== "object") {
        return Response.json({ success: false, code: "invalid_query", message: "Add a subject to search for." }, { status: 400 })
      }
      const record = payload as Record<string, unknown>
      const subject = typeof record.subject === "string" ? record.subject.trim() : ""
      const category = record.category
      const personName = typeof record.personName === "string" ? record.personName.trim() : ""
      const focus = typeof record.focus === "string" ? record.focus.trim() : ""
      if (!categories.includes(category as PublicInformationCategory) || !subject || subject.length > 300 || focus.length > 1_000) {
        return Response.json({ success: false, code: "invalid_query", message: "Check the subject and search details, then try again." }, { status: 400 })
      }
      if (category === "person" && (!personName || personName.length > 200)) {
        return Response.json({ success: false, code: "person_name_required", message: "Enter the person’s name or public identifier to search. Rocky will not identify someone from their face." }, { status: 400 })
      }

      const result = await dependencies.provider.search({
        category: category as PublicInformationCategory,
        subject,
        ...(category === "person" ? { personName } : {}),
        ...(focus ? { focus } : {}),
      })
      return Response.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      const providerError = error as { code?: unknown; status?: unknown; requestId?: unknown }
      const code = typeof providerError?.code === "string" ? providerError.code : "search_unavailable"
      const status = code === "missing_api_key" || code === "capability_disabled" || code === "unauthorized" || code === "forbidden"
        ? 503
        : code === "rate_limited" || providerError?.status === 429
          ? 429
          : 502
      const message = status === 429
        ? "Public information search is busy. Wait a moment and try again."
        : "Public information search is unavailable. Check the Meta Model API search access and try again."
      dependencies.logError?.({
        event: "public_information_search",
        requestId,
        providerRequestId: typeof providerError?.requestId === "string" ? providerError.requestId : undefined,
        code,
        status,
      })
      return Response.json({ success: false, requestId, code: status === 503 ? "search_unavailable" : code, message }, {
        status,
        headers: { "Cache-Control": "no-store" },
      })
    }
  }
}
