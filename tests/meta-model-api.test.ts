import assert from "node:assert/strict"
import test from "node:test"
import {
  MetaModelApiError,
  metaModelApiTesting,
  recordsOfKind,
  type ImageInput,
  type VisualAnalysis,
} from "../lib/meta-model-api"

const env = {
  MODEL_API_KEY: "test-token",
  MODEL_API_BASE_URL: "https://meta.test/v1",
  META_MUSE_WONDER_MODEL: "muse-wonder-1.0",
  META_MUSE_IMAGE_MODEL: "muse-image-1.0",
  META_MUSE_VOICE_MODEL: "muse-voice-transcribe-1.0",
}

const pngImage: ImageInput = {
  mimeType: "image/png",
  bytes: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
}

const analysis: VisualAnalysis = {
  subject: "red fox",
  category: "animal",
  shortDescription: "A red fox standing in snow.",
  visualDetails: ["Reddish fur", "Snow-covered ground"],
  confidence: "high",
  followUpSuggestions: ["Ask about the fox's habitat."],
}

function responsePayload(outputText: string, output?: unknown[]) {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1,
    status: "completed",
    error: null,
    incomplete_details: null,
    model: "test-model",
    output_text: outputText,
    output: output ?? [{
      id: "msg_test",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: outputText, annotations: [] }],
    }],
  }
}

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers)) },
  })
}

function silentLogger() {
  return { info: () => {}, error: () => {} }
}

function mockFetch(
  handler: (url: URL, init: RequestInit) => Response | Promise<Response>,
  calls: Array<{ url: URL; init: RequestInit }> = [],
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const requestInit = init ?? (input instanceof Request ? { method: input.method, headers: input.headers } : {})
    calls.push({ url, init: requestInit })
    return handler(url, requestInit)
  }) as typeof fetch
}

function responseStream(text: string) {
  const events = [
    {
      type: "response.output_text.delta",
      item_id: "msg_test",
      output_index: 0,
      content_index: 0,
      delta: text,
      sequence_number: 1,
    },
    {
      type: "response.output_text.done",
      item_id: "msg_test",
      output_index: 0,
      content_index: 0,
      text,
      sequence_number: 2,
    },
    {
      type: "response.completed",
      response: responsePayload(text),
      sequence_number: 3,
    },
  ]
  const body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("")
  return new Response(body, { headers: { "content-type": "text/event-stream" } })
}

test("capability check reflects account model access and optional model configuration", async () => {
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch((url) => {
      assert.equal(url.pathname, "/v1/models")
      return jsonResponse({
        object: "list",
        data: ["muse-spark-1.3", "sam-3.1", "muse-wonder-1.0", "muse-image-1.0", "muse-voice-transcribe-1.0"]
          .map((id) => ({ id, object: "model", created: 1, owned_by: "meta" })),
      })
    }),
  })

  const result = await api.checkCapabilities()
  assert.deepEqual(result.capabilities.map((item) => item.status), ["available", "available", "available", "available", "available"])
})

test("capability check reports missing credentials and disables unconfigured optional models", async () => {
  const api = metaModelApiTesting.createMetaModelApi({ env: {}, logger: silentLogger() })
  const result = await api.checkCapabilities()
  assert.deepEqual(result.capabilities.map((item) => item.status), ["unavailable", "unavailable", "disabled", "disabled", "disabled"])
})

test("image analysis uses documented Responses input and validates structured output", async () => {
  const calls: Array<{ url: URL; init: RequestInit }> = []
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch((url, init) => {
      assert.equal(url.pathname, "/v1/responses")
      const body = JSON.parse(String(init.body))
      assert.equal(body.model, "muse-spark-1.3")
      assert.equal(body.store, false)
      assert.equal(body.text.format.type, "json_schema")
      assert.equal(body.input[0].content[1].type, "input_image")
      assert.match(body.input[0].content[1].image_url, /^data:image\/png;base64,/)
      return jsonResponse(responsePayload(JSON.stringify(analysis)))
    }, calls),
  })

  const result = await api.analyzeImage(pngImage)
  assert.equal(result.result.subject, "red fox")
  assert.equal(result.model, "muse-spark-1.3")
  assert.equal(calls.length, 1)
})

test("malformed structured analysis is rejected", async () => {
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch(() => jsonResponse(responsePayload("not-json"))),
  })
  await assert.rejects(api.analyzeImage(pngImage), (error: unknown) => {
    assert.ok(error instanceof MetaModelApiError)
    assert.equal(error.code, "malformed_response")
    return true
  })
})

test("SAM streaming output is parsed into typed boxes and masks", async () => {
  const output = "<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|><|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>"
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch((url, init) => {
      assert.equal(url.pathname, "/v1/responses")
      const body = JSON.parse(String(init.body))
      assert.equal(body.model, "sam-3.1")
      assert.equal(body.stream, true)
      assert.equal(body.metadata.mask_encoding, "one_bit")
      return responseStream(output)
    }),
  })

  const result = await api.segmentImage(pngImage, "fox")
  assert.equal(result.result.outcome.status, "completed")
  assert.equal(recordsOfKind(result.result.records, "box").length, 1)
  assert.equal(recordsOfKind(result.result.records, "mask").length, 1)
})

test("Spark follow-up and Wonder research return text and grounded citation URLs", async () => {
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch((url, init) => {
      if (url.pathname.endsWith("/models")) {
        return jsonResponse({ object: "list", data: [] })
      }
      const body = JSON.parse(String(init.body))
      if (body.tools?.some((tool: { type: string }) => tool.type === "web_search")) {
        const citation = { type: "url_citation", title: "Fox facts", url: "https://example.org/fox", start_index: 0, end_index: 12 }
        return jsonResponse(responsePayload("Foxes are mammals.", [
          { type: "web_search_call", id: "ws_test", status: "completed", results: [] },
          { type: "message", id: "msg_test", role: "assistant", status: "completed", content: [{ type: "output_text", text: "Foxes are mammals.", annotations: [citation] }] },
        ]))
      }
      return jsonResponse(responsePayload("Foxes are mammals."))
    }),
  })

  const followUp = await api.askMuseSparkFollowUp(pngImage, analysis, "What does it eat?")
  assert.equal(followUp.result.answer, "Foxes are mammals.")
  const research = await api.researchWithMuseWonder("Fox habitat and diet")
  assert.equal(research.result.searched, true)
  assert.deepEqual(research.result.sources, [{ title: "Fox facts", url: "https://example.org/fox" }])
})

test("Muse Image generation and edit use the configured model and validate image output", async () => {
  const calls: Array<{ url: URL; init: RequestInit }> = []
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch((url, init) => {
      calls.push({ url, init })
      return jsonResponse({ created: 1, data: [{ b64_json: "aGVsbG8=", revised_prompt: "A red fox" }] })
    }),
  })

  const generated = await api.generateMuseImage("A watercolor fox")
  const edited = await api.editMuseImage(pngImage, "Add a blue scarf")
  assert.equal(generated.result.b64Json, "aGVsbG8=")
  assert.equal(edited.result.b64Json, "aGVsbG8=")
  assert.ok(calls.some((call) => call.url.pathname === "/v1/images/generations"))
  assert.ok(calls.some((call) => call.url.pathname === "/v1/images/edits"))
})

test("Voice Transcribe sends WAV multipart request and validates the transcript", async () => {
  let capturedRequest: FormData | undefined
  const audio = Uint8Array.from([...Buffer.from("RIFF"), 36, 0, 0, 0, ...Buffer.from("WAVEfmt ")])
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch((_url, init) => {
      capturedRequest = init.body as FormData
      return jsonResponse({
        sessionId: "voice-test",
        transcript: "What is this animal?",
        audioDurationMs: 2300,
        turns: [{ turnId: 1, startMs: 0, endMs: 2300, transcript: "What is this animal?", speaker: "A" }],
      })
    }),
  })

  const result = await api.transcribeMuseVoice({ bytes: audio })
  assert.equal(result.result.transcript, "What is this animal?")
  assert.ok(capturedRequest?.get("request"))
  assert.ok(capturedRequest?.get("audio"))
})

test("rate limit errors are typed and retain Retry-After without exposing provider bodies", async () => {
  const api = metaModelApiTesting.createMetaModelApi({
    env,
    logger: silentLogger(),
    fetch: mockFetch(() => jsonResponse({ error: { message: "private provider detail" } }, 429, { "retry-after": "2" })),
  })
  await assert.rejects(api.analyzeImage(pngImage), (error: unknown) => {
    assert.ok(error instanceof MetaModelApiError)
    assert.equal(error.code, "rate_limited")
    assert.equal(error.retryAfterMs, 2000)
    assert.equal(error.message.includes("private provider detail"), false)
    return true
  })
})

test("optional services remain disabled when their model ID is not configured", async () => {
  const api = metaModelApiTesting.createMetaModelApi({
    env: { MODEL_API_KEY: env.MODEL_API_KEY },
    logger: silentLogger(),
  })
  await assert.rejects(api.generateMuseImage("A blue bird"), (error: unknown) => {
    assert.ok(error instanceof MetaModelApiError)
    assert.equal(error.code, "capability_disabled")
    return true
  })
})
