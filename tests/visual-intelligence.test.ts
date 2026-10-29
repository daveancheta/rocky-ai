import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"
import {
  cameraAccessErrorMessage,
  MAX_VISUAL_IMAGE_BYTES,
  uploadVisualImage,
  validateVisualImageFile,
  VisualImageValidationError,
  VisualUploadError,
  requestVisualCamera,
} from "../lib/visual-intelligence-client"
import {
  createVisualAnalysisPostHandler,
  validateUploadedVisualImage,
  VisualUploadValidationError,
} from "../lib/visual-intelligence-upload"

function imageFile(bytes: Uint8Array, type = "image/png", name = "sample.png") {
  return new File([Uint8Array.from(bytes).buffer], name, { type })
}

async function validPng() {
  return new Uint8Array(await sharp({ create: { width: 3, height: 2, channels: 3, background: "#db8b56" } }).png().toBuffer())
}

class FakeXhr {
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null }
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  onload: (() => void) | null = null
  responseText = ""
  status = 0
  withCredentials = false
  method = ""
  url = ""
  sentBody: FormData | null = null

  open(method: string, url: string) { this.method = method; this.url = url }
  send(body: FormData) { this.sentBody = body }
}

test("client rejects unsupported, oversized, and corrupt image files", async () => {
  const decode = async () => ({ width: 10, height: 10 })
  await assert.rejects(validateVisualImageFile(imageFile(new Uint8Array([1]), "image/gif"), decode), (error: unknown) => {
    assert.ok(error instanceof VisualImageValidationError)
    assert.equal(error.code, "unsupported_type")
    return true
  })
  await assert.rejects(validateVisualImageFile(imageFile(new Uint8Array(MAX_VISUAL_IMAGE_BYTES + 1)), decode), (error: unknown) => {
    assert.ok(error instanceof VisualImageValidationError)
    assert.equal(error.code, "file_too_large")
    return true
  })
  await assert.rejects(validateVisualImageFile(imageFile(new Uint8Array([1])), async () => { throw new Error("decode failed") }), (error: unknown) => {
    assert.ok(error instanceof VisualImageValidationError)
    assert.equal(error.code, "corrupt_image")
    return true
  })
})

test("client rejects images beyond supported pixel dimensions", async () => {
  await assert.rejects(validateVisualImageFile(imageFile(new Uint8Array([1])), async () => ({ width: 20_000, height: 1 })), (error: unknown) => {
    assert.ok(error instanceof VisualImageValidationError)
    assert.equal(error.code, "dimensions_too_large")
    return true
  })
})

test("camera denial has an actionable recovery message", () => {
  const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" })
  assert.match(cameraAccessErrorMessage(denied), /browser settings/i)
  assert.match(cameraAccessErrorMessage(denied), /upload/i)
})

test("camera is requested only when invoked and denial is returned as a recovery error", async () => {
  let requests = 0
  const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" })
  await assert.rejects(requestVisualCamera(async () => {
    requests++
    throw denied
  }), /camera access was blocked/i)
  assert.equal(requests, 1)
})

test("upload helper reports progress and resolves successful analysis", async () => {
  const xhr = new FakeXhr()
  const progress: number[] = []
  const pending = uploadVisualImage(imageFile(new Uint8Array([1])), "What is it?", (item) => progress.push(item.percent), () => xhr as unknown as XMLHttpRequest)
  assert.equal(xhr.method, "POST")
  assert.equal(xhr.url, "/api/visual-intelligence/analyze")
  assert.equal(xhr.withCredentials, true)
  xhr.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent)
  xhr.status = 200
  xhr.responseText = JSON.stringify({ success: true, analysis: { requestId: "r1", model: "muse-spark-1.3", result: { subject: "cup" } } })
  xhr.onload?.()
  const payload = await pending
  assert.equal(payload.analysis.result.subject, "cup")
  assert.deepEqual(progress, [50])
  assert.equal(xhr.sentBody?.get("question"), "What is it?")
})

test("upload helper surfaces backend failures for retry", async () => {
  const xhr = new FakeXhr()
  const pending = uploadVisualImage(imageFile(new Uint8Array([1])), "", () => undefined, () => xhr as unknown as XMLHttpRequest)
  xhr.status = 502
  xhr.responseText = JSON.stringify({ success: false, code: "analysis_failed", message: "Rocky could not analyze this image." })
  xhr.onload?.()
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof VisualUploadError)
    assert.equal(error.status, 502)
    assert.match(error.message, /could not analyze/i)
    return true
  })
})

test("server fully decodes an uploaded image and rejects corrupted bytes", async () => {
  const valid = await validPng()
  const checked = await validateUploadedVisualImage(imageFile(valid))
  assert.deepEqual([checked.width, checked.height], [3, 2])
  await assert.rejects(validateUploadedVisualImage(imageFile(new Uint8Array([137, 80, 78, 71]))), (error: unknown) => {
    assert.ok(error instanceof VisualUploadValidationError)
    assert.equal(error.code, "corrupt_image")
    return true
  })
  await assert.rejects(validateUploadedVisualImage(imageFile(valid, "image/gif")), (error: unknown) => {
    assert.ok(error instanceof VisualUploadValidationError)
    assert.equal(error.code, "unsupported_type")
    return true
  })
  await assert.rejects(validateUploadedVisualImage(imageFile(new Uint8Array(MAX_VISUAL_IMAGE_BYTES + 1))), (error: unknown) => {
    assert.ok(error instanceof VisualUploadValidationError)
    assert.equal(error.code, "file_too_large")
    return true
  })
  const tooWide = new Uint8Array(await sharp({ create: { width: 10_001, height: 1, channels: 3, background: "#000" } }).png().toBuffer())
  await assert.rejects(validateUploadedVisualImage(imageFile(tooWide)), (error: unknown) => {
    assert.ok(error instanceof VisualUploadValidationError)
    assert.equal(error.code, "dimensions_too_large")
    return true
  })
})

test("authenticated endpoint refuses anonymous users without calling analysis", async () => {
  let calls = 0
  const post = createVisualAnalysisPostHandler({
    getSession: async () => null,
    analyzeImage: async () => { calls++; return {} },
  })
  const response = await post(new Request("https://rocky.test/api/visual-intelligence/analyze", { method: "POST" }))
  assert.equal(response.status, 401)
  assert.equal(calls, 0)
})

test("authenticated endpoint validates and analyzes an image transiently", async () => {
  const valid = await validPng()
  let analyzedMime = ""
  let analyzedQuestion: string | undefined
  const post = createVisualAnalysisPostHandler({
    getSession: async () => ({ user: { id: "user-test" } }),
    analyzeImage: async (image, question) => {
      analyzedMime = image.mimeType
      analyzedQuestion = question
      return { requestId: "provider-r1", model: "muse-spark-1.3", result: { subject: "cup" } }
    },
  })
  const form = new FormData()
  form.append("image", imageFile(valid))
  form.append("question", "What is this used for?")
  const response = await post(new Request("https://rocky.test/api/visual-intelligence/analyze", {
    method: "POST",
    headers: { origin: "https://rocky.test" },
    body: form,
  }))
  const body = await response.json() as { success: boolean; analysis: { model: string } }
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(body.success, true)
  assert.equal(body.analysis.model, "muse-spark-1.3")
  assert.equal(analyzedMime, "image/png")
  assert.equal(analyzedQuestion, "What is this used for?")
})

test("endpoint explains when Muse Spark is not configured", async () => {
  const post = createVisualAnalysisPostHandler({
    getSession: async () => ({ user: { id: "user-test" } }),
    analyzeImage: async () => { throw Object.assign(new Error("missing key"), { code: "missing_api_key" }) },
  })
  const form = new FormData()
  form.append("image", imageFile(await validPng()))
  const response = await post(new Request("https://rocky.test/api/visual-intelligence/analyze", {
    method: "POST",
    headers: { origin: "https://rocky.test" },
    body: form,
  }))
  const body = await response.json() as { code: string; message: string }
  assert.equal(response.status, 503)
  assert.equal(body.code, "missing_api_key")
  assert.match(body.message, /MODEL_API_KEY/)
})
