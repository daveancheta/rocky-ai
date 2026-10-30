"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { AlertCircle, ArrowLeft, Camera, Check, ExternalLink, ImagePlus, Layers3, LoaderCircle, RotateCcw, ScanEye, Search, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  cameraAccessErrorMessage,
  requestVisualCamera,
  searchVisualPublicInformation,
  uploadVisualAction,
  uploadVisualImage,
  validateVisualImageFile,
  VisualImageValidationError,
  type UploadProgress,
  type VisualAnalysisResponse,
  type PublicInformationResponse,
  type VisualObjectExplanationResponse,
  type VisualSegmentationResponse,
} from "@/lib/visual-intelligence-client"

type SubmitState = "idle" | "uploading" | "analyzing" | "success" | "error"

const detectionColors = ["#fb923c", "#38bdf8", "#a3e635", "#e879f9", "#facc15", "#2dd4bf", "#f87171", "#818cf8"]

export function VisualIntelligenceForm() {
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState("")
  const [cameraActive, setCameraActive] = useState(false)
  const [state, setState] = useState<SubmitState>("idle")
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState("")
  const [analysis, setAnalysis] = useState<VisualAnalysisResponse | null>(null)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [segmentation, setSegmentation] = useState<VisualSegmentationResponse | null>(null)
  const [explanation, setExplanation] = useState<VisualObjectExplanationResponse | null>(null)
  const [objectQuestion, setObjectQuestion] = useState("")
  const [actionLoading, setActionLoading] = useState<"segment" | "explain" | null>(null)
  const [actionError, setActionError] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")
  const [cameraMessage, setCameraMessage] = useState("")
  const [publicPersonName, setPublicPersonName] = useState("")
  const [publicInformationFocus, setPublicInformationFocus] = useState("")
  const [publicInformation, setPublicInformation] = useState<PublicInformationResponse | null>(null)
  const [publicInformationLoading, setPublicInformationLoading] = useState(false)
  const [publicInformationError, setPublicInformationError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const fallbackCameraRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewUrlRef = useRef("")

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play().catch(() => undefined)
    }
  }, [cameraActive])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  const chooseFile = (next: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = next ? URL.createObjectURL(next) : ""
    setPreviewUrl(previewUrlRef.current)
    setError("")
    setCameraMessage("")
    setAnalysis(null)
    setSelectedObjectId(null)
    setSegmentation(null)
    setExplanation(null)
    setActionError("")
    setObjectQuestion("")
    setPublicPersonName("")
    setPublicInformationFocus("")
    setPublicInformation(null)
    setPublicInformationError("")
    setState("idle")
    setProgress(null)
    setFile(next)
  }

  const acceptFile = async (candidate: File | null) => {
    if (!candidate) return
    try {
      await validateVisualImageFile(candidate)
      chooseFile(candidate)
    } catch (validationError) {
      chooseFile(null)
      setError(validationError instanceof VisualImageValidationError
        ? validationError.message
        : "This image could not be opened. Try another file.")
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void acceptFile(event.target.files?.[0] ?? null)
    event.target.value = ""
  }

  const openCamera = async () => {
    setError("")
    setCameraMessage("")
    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackCameraRef.current?.click()
      return
    }
    try {
      const stream = await requestVisualCamera(() => navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      }))
      streamRef.current = stream
      setCameraActive(true)
    } catch (cameraError) {
      setCameraMessage(cameraError instanceof Error ? cameraError.message : cameraAccessErrorMessage(cameraError))
    }
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraMessage("The camera is still getting ready. Try again in a moment.")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) {
      setCameraMessage("This browser could not capture the photo. Choose an image to upload instead.")
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
    if (!blob) {
      setCameraMessage("The photo could not be captured. Try again.")
      return
    }
    const photo = new File([blob], `rocky-photo-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
    stopCamera()
    await acceptFile(photo)
  }

  const submit = async () => {
    if (!file || state === "uploading" || state === "analyzing") return
    setError("")
    setAnalysis(null)
    setSelectedObjectId(null)
    setSegmentation(null)
    setExplanation(null)
    setPublicInformation(null)
    setPublicInformationError("")
    setActionError("")
    setProgress({ loaded: 0, total: file.size, percent: 0 })
    setState("uploading")
    try {
      const response = await uploadVisualImage(file, question, (nextProgress) => {
        setProgress(nextProgress)
        if (nextProgress.percent >= 100) setState("analyzing")
      })
      setAnalysis(response.analysis)
      setSelectedObjectId(response.analysis.result.objects.length === 1 ? response.analysis.result.objects[0].id : null)
      setSegmentation(null)
      setExplanation(null)
      setState("success")
    } catch (uploadError) {
      setState("error")
      setError(uploadError instanceof Error ? uploadError.message : "Rocky could not analyze this image. Try again.")
    }
  }

  const busy = state === "uploading" || state === "analyzing"
  const selectedObject = analysis?.result.objects.find((object) => object.id === selectedObjectId) ?? null

  const runObjectAction = async (action: "segment" | "explain") => {
    if (!file || !analysis || !selectedObject || actionLoading) return
    setActionLoading(action)
    setActionError("")
    try {
      const fields = {
        analysisRequestId: analysis.requestId,
        objectId: selectedObject.id,
        label: selectedObject.label,
        bbox: selectedObject.bbox ? JSON.stringify(selectedObject.bbox) : "",
        question: objectQuestion.trim(),
      }
      if (action === "segment") {
        if (!selectedObject.bbox) throw new Error("Rocky could not locate this object precisely enough to draw a mask.")
        const response = await uploadVisualAction<{ success: true; segmentation: VisualSegmentationResponse }>(
          "/api/visual-intelligence/segment", file, fields, () => undefined,
        )
        if (response.segmentation.analysisRequestId !== analysis.requestId || response.segmentation.objectId !== selectedObject.id) {
          throw new Error("The mask did not match this image analysis. Try again.")
        }
        setSegmentation(response.segmentation)
      } else {
        const response = await uploadVisualAction<{ success: true; explanation: VisualObjectExplanationResponse }>(
          "/api/visual-intelligence/explain", file, fields, () => undefined,
        )
        if (response.explanation.analysisRequestId !== analysis.requestId || response.explanation.objectId !== selectedObject.id) {
          throw new Error("The explanation did not match this image analysis. Try again.")
        }
        setExplanation(response.explanation)
      }
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : "Rocky could not complete this object action. Try again.")
    } finally {
      setActionLoading(null)
    }
  }

  const findPublicInformation = async () => {
    if (!analysis || publicInformationLoading) return
    setPublicInformationLoading(true)
    setPublicInformationError("")
    setPublicInformation(null)
    try {
      const response = await searchVisualPublicInformation({
        category: analysis.result.category,
        subject: analysis.result.identification,
        ...(analysis.result.category === "person" ? { personName: publicPersonName.trim() } : {}),
        ...(publicInformationFocus.trim() ? { focus: publicInformationFocus.trim() } : {}),
      })
      setPublicInformation(response)
    } catch (searchError) {
      setPublicInformationError(searchError instanceof Error ? searchError.message : "Public information search could not be completed. Try again.")
    } finally {
      setPublicInformationLoading(false)
    }
  }

  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = maskCanvasRef.current
    if (!canvas || !segmentation || !analysis) return
    const scale = Math.min(1, 1600 / analysis.imageWidth)
    canvas.width = Math.max(1, Math.round(analysis.imageWidth * scale))
    canvas.height = Math.max(1, Math.round(analysis.imageHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)

    const raster = Uint8Array.from(atob(segmentation.mask.dataBase64), (character) => character.charCodeAt(0))
    if (raster.length !== segmentation.mask.width * segmentation.mask.height) return
    const maskCanvas = document.createElement("canvas")
    maskCanvas.width = segmentation.mask.width
    maskCanvas.height = segmentation.mask.height
    const maskContext = maskCanvas.getContext("2d")
    if (!maskContext) return
    const maskPixels = maskContext.createImageData(maskCanvas.width, maskCanvas.height)
    for (let index = 0; index < raster.length; index++) {
      if (raster[index] === 0) continue
      const offset = index * 4
      maskPixels.data[offset] = 180
      maskPixels.data[offset + 1] = 72
      maskPixels.data[offset + 2] = 13
      maskPixels.data[offset + 3] = 135
    }
    maskContext.putImageData(maskPixels, 0, 0)
    const xScale = canvas.width / analysis.imageWidth
    const yScale = canvas.height / analysis.imageHeight
    const bounds = segmentation.mask.bounds
    context.drawImage(
      maskCanvas,
      bounds.left * xScale,
      bounds.top * yScale,
      (bounds.right - bounds.left) * xScale,
      (bounds.bottom - bounds.top) * yScale,
    )
  }, [analysis, segmentation])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <Card className="gap-0 border border-border p-4 ring-0 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <ScanEye size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="m-0 text-base font-medium leading-snug">Add a photo</h2>
            <p className="mb-0 mt-1 text-sm leading-relaxed text-muted-foreground">Take a picture or choose one from your device. Your image is sent securely for this analysis and is not saved by Rocky.</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onFileChange}
          tabIndex={-1}
          aria-label="Choose a JPEG, PNG, or WebP image"
        />
        <input
          ref={fallbackCameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={onFileChange}
          tabIndex={-1}
          aria-label="Take a photo"
        />

        {cameraActive ? (
          <div className="grid gap-3">
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-video max-h-[460px] w-full object-contain" aria-label="Camera preview" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void capturePhoto()}><Camera aria-hidden="true" /> Capture photo</Button>
              <Button type="button" variant="outline" onClick={stopCamera}><X aria-hidden="true" /> Cancel camera</Button>
            </div>
          </div>
        ) : file && previewUrl ? (
          <div className="grid gap-3">
            <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
              <Image src={previewUrl} alt={`Selected image: ${file.name}`} width={1200} height={800} unoptimized className="mx-auto max-h-[460px] w-full object-contain" />
              <span className="absolute bottom-3 left-3 max-w-[75%] truncate rounded-md bg-background/90 px-2.5 py-1.5 text-xs text-foreground shadow-sm">{file.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => void openCamera()}><RotateCcw aria-hidden="true" /> Retake photo</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus aria-hidden="true" /> Replace image</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => chooseFile(null)}><Trash2 aria-hidden="true" /> Remove</Button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-input bg-muted/40 p-5 text-center sm:min-h-60">
            <div className="grid justify-items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><ImagePlus size={21} aria-hidden="true" /></span>
              <div>
                <p className="m-0 text-sm font-medium">Start with a photo</p>
                <p className="mb-0 mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP · up to 10 MB</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => void openCamera()}><Camera aria-hidden="true" /> Take a photo</Button>
                <Button type="button" onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" /> Choose image</Button>
              </div>
            </div>
          </div>
        )}

        {cameraMessage && (
          <p role="alert" className="mb-0 mt-3 flex items-start gap-2 text-sm text-destructive"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{cameraMessage}</p>
        )}
        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="m-0">{error}</p>
          </div>
        )}

        <label htmlFor="visual-question" className="mb-1.5 mt-5 text-sm font-medium">Ask Rocky a question <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea
          id="visual-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, 2_000))}
          placeholder="What is this used for?"
          maxLength={2_000}
          rows={3}
          disabled={busy}
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>Rocky will focus on what can be seen in the image.</span><span>{question.length}/2,000</span></div>

        {busy && (
          <div className="mt-4" role="status" aria-live="polite">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-foreground">{state === "analyzing" ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}{state === "analyzing" ? "Rocky is analyzing your image…" : "Uploading image…"}</span>
              {progress && <span className="text-muted-foreground">{progress.percent}%</span>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Image upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0}>
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress?.percent ?? 0}%` }} />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="m-0 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Your image is processed for this request and not stored.</p>
          <Button type="button" disabled={!file || busy} onClick={() => void submit()}>
            {busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" />{state === "analyzing" ? "Analyzing…" : "Uploading…"}</> : state === "error" ? <><RotateCcw aria-hidden="true" />Retry analysis</> : <><ScanEye aria-hidden="true" />Analyze image</>}
          </Button>
        </div>
      </Card>

      {analysis && state === "success" && (
        <>
          <Card className="gap-0 border border-border p-4 ring-0 sm:p-6" aria-live="polite">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Check size={18} aria-hidden="true" /></span>
                <div><span className="eyebrow">ROCKY&apos;S ANALYSIS</span><h2 className="mb-0 mt-1 text-lg font-medium">{analysis.result.title}</h2></div>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{analysis.model}</span>
            </div>

            <div className="relative mx-auto mb-5 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-muted" style={{ aspectRatio: `${analysis.imageWidth} / ${analysis.imageHeight}` }}>
              <Image src={previewUrl} alt="Original uploaded image with detected object locations" fill unoptimized className="object-contain" />
              {analysis.result.objects.map((object, index) => object.bbox && (
                <div
                  key={object.id}
                  aria-hidden="true"
                  className={`absolute ${object.id === selectedObjectId ? "border-[3px]" : "border-2"}`}
                  style={{
                    left: `${object.bbox.xMin / 10}%`,
                    top: `${object.bbox.yMin / 10}%`,
                    width: `${(object.bbox.xMax - object.bbox.xMin) / 10}%`,
                    height: `${(object.bbox.yMax - object.bbox.yMin) / 10}%`,
                    borderColor: detectionColors[index % detectionColors.length],
                  }}
                >
                  <span className="absolute left-0 top-0 -translate-y-full rounded-t px-1.5 py-0.5 text-[10px] font-medium text-black" style={{ backgroundColor: detectionColors[index % detectionColors.length] }}>{object.label}</span>
                </div>
              ))}
              <canvas ref={maskCanvasRef} aria-label={segmentation ? `SAM 3.1 mask for ${selectedObject?.label ?? "selected object"}` : undefined} className="pointer-events-none absolute inset-0 h-full w-full" />
            </div>
            <p className="mb-4 mt-0 text-xs text-muted-foreground">Bounding boxes from {analysis.model}{segmentation && ` · Segmentation mask from ${segmentation.model}`}</p>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{analysis.result.category}</span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{analysis.result.identificationConfidence} confidence</span>
            </div>
            <h3 className="mb-1 mt-0 text-sm font-semibold">Best-supported identification</h3>
            <p className="mb-3 mt-0 text-sm leading-relaxed">{analysis.result.identification}</p>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">{analysis.result.shortDescription}</p>

            {analysis.result.visualObservations.length > 0 && (
              <section className="mt-5 border-t border-border pt-4" aria-label="Visual observations">
                <h3 className="mb-2 mt-0 text-sm font-semibold">Visible in the image</h3>
                <ul className="mb-0 mt-0 grid gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {analysis.result.visualObservations.map((detail, index) => <li key={`${index}-${detail}`}>{detail}</li>)}
                </ul>
              </section>
            )}
            {analysis.result.distinguishingFeatures.length > 0 && (
              <section className="mt-4" aria-label="Distinguishing features">
                <h3 className="mb-2 mt-0 text-sm font-semibold">Distinguishing features</h3>
                <ul className="mb-0 mt-0 grid gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {analysis.result.distinguishingFeatures.map((detail, index) => <li key={`${index}-${detail}`}>{detail}</li>)}
                </ul>
              </section>
            )}
            {analysis.result.contextNotes.length > 0 && (
              <section className="mt-4" aria-label="Context and verification">
                <h3 className="mb-2 mt-0 text-sm font-semibold">Context</h3>
                <div className="grid gap-2">
                  {analysis.result.contextNotes.map((note, index) => (
                    <div key={`${index}-${note.text}`} className="rounded-lg bg-muted/60 p-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{note.evidence === "visual_observation" ? "Visual observation" : note.evidence === "general_context" ? "General context" : "Needs external verification"}</span>
                      <p className="mb-0 mt-1 text-sm leading-relaxed">{note.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {(analysis.result.uncertainty || analysis.result.alternatives.length > 0) && (
              <section className="mt-4 rounded-lg border border-border p-3" aria-label="Uncertainty">
                <h3 className="mb-1 mt-0 text-sm font-semibold">Uncertainty</h3>
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">{analysis.result.uncertainty}</p>
                {analysis.result.alternatives.length > 0 && <p className="mb-0 mt-2 text-sm leading-relaxed text-muted-foreground">Other possibilities: {analysis.result.alternatives.join(" · ")}</p>}
              </section>
            )}

            {analysis.result.objects.length > 0 && (
              <section className="mt-5 border-t border-border pt-4" aria-labelledby="detected-objects-title">
                <h3 id="detected-objects-title" className="mb-2 mt-0 text-sm font-semibold">Detected objects</h3>
                <p className="mb-3 mt-0 text-xs text-muted-foreground">{analysis.result.objects.length > 1 ? "Select an object to inspect or explain it." : "Select this object to inspect or explain it."}</p>
                <div className="grid gap-2">
                  {analysis.result.objects.map((object) => (
                    <button
                      key={object.id}
                      type="button"
                      onClick={() => {
                        setSelectedObjectId(object.id)
                        setSegmentation(null)
                        setExplanation(null)
                        setActionError("")
                      }}
                      aria-pressed={selectedObjectId === object.id}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedObjectId === object.id ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:bg-muted"}`}
                    >
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{object.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{object.category} · {object.confidence} confidence{!object.bbox && " · no precise location"}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{selectedObjectId === object.id ? "Selected" : "Select"}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {selectedObject && (
              <section className="mt-4 rounded-lg bg-muted/50 p-3" aria-label={`Actions for ${selectedObject.label}`}>
                <label htmlFor="object-question" className="mb-1.5 block text-sm font-medium">Ask about {selectedObject.label}</label>
                <textarea id="object-question" rows={2} maxLength={2000} value={objectQuestion} onChange={(event) => setObjectQuestion(event.target.value.slice(0, 2000))} placeholder="What might this be used for?" disabled={actionLoading !== null} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={actionLoading !== null || !selectedObject.bbox} onClick={() => void runObjectAction("segment")}>
                    {actionLoading === "segment" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Layers3 aria-hidden="true" />}
                    {actionLoading === "segment" ? "Segmenting…" : segmentation ? "Refresh SAM mask" : "Outline with SAM 3.1"}
                  </Button>
                  <Button type="button" variant="outline" disabled={actionLoading !== null} onClick={() => void runObjectAction("explain")}>
                    {actionLoading === "explain" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ScanEye aria-hidden="true" />}
                    {actionLoading === "explain" ? "Explaining…" : "Explain this object"}
                  </Button>
                </div>
                {!selectedObject.bbox && <p className="mb-0 mt-2 text-xs text-muted-foreground">SAM needs a visible location; Rocky could not confidently place a box around this object.</p>}
                {actionError && <p role="alert" className="mb-0 mt-3 text-sm text-destructive">{actionError}</p>}
                {explanation && <div className="mt-3 rounded-lg border border-border bg-card p-3"><p className="mb-1 mt-0 text-xs font-semibold text-muted-foreground">Muse Spark · {explanation.model}</p><p className="m-0 whitespace-pre-wrap text-sm leading-relaxed">{explanation.answer}</p></div>}
                {segmentation && <p className="mb-0 mt-2 text-xs text-muted-foreground">The colored overlay shows the SAM 3.1 mask aligned to the original image.</p>}
              </section>
            )}

            {analysis.result.followUpSuggestions.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 mt-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">You could ask</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.result.followUpSuggestions.map((suggestion) => (
                    <Button key={suggestion} type="button" variant="outline" size="sm" onClick={() => setQuestion(suggestion)}>{suggestion}</Button>
                  ))}
                </div>
              </div>
            )}

            <section className="mt-5 border-t border-border pt-4" aria-labelledby="public-information-title">
              <h3 id="public-information-title" className="mb-1 mt-0 text-sm font-semibold">Public information</h3>
              <p className="mb-3 mt-0 text-sm leading-relaxed text-muted-foreground">Search public sources related to Rocky&apos;s visual analysis. Search results are separate from what the image itself shows.</p>
              {analysis.result.category === "person" && (
                <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3">
                  <label htmlFor="public-person-name" className="mb-1.5 block text-sm font-medium">Enter a name or public identifier</label>
                  <input id="public-person-name" value={publicPersonName} maxLength={200} onChange={(event) => setPublicPersonName(event.target.value.slice(0, 200))} placeholder="Name, role, organization, or official identifier" disabled={publicInformationLoading} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60" />
                  <p className="mb-0 mt-2 text-xs leading-relaxed text-muted-foreground">Rocky will search only the details you enter. Search results are not matched to the person in your photo, and account verification must be checked on the linked publisher or platform.</p>
                </div>
              )}
              <label htmlFor="public-information-focus" className="mb-1.5 block text-sm font-medium">What would you like to know? <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input id="public-information-focus" value={publicInformationFocus} maxLength={1000} onChange={(event) => setPublicInformationFocus(event.target.value.slice(0, 1000))} placeholder={analysis.result.category === "animal" ? "Habitat, diet, behavior, or conservation" : analysis.result.category === "product" ? "Manufacturer, purpose, or official documentation" : "History, background, or reliable references"} disabled={publicInformationLoading} className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60" />
              <Button type="button" variant="outline" disabled={publicInformationLoading || (analysis.result.category === "person" && !publicPersonName.trim())} onClick={() => void findPublicInformation()}>
                {publicInformationLoading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
                {publicInformationLoading ? "Searching public sources…" : publicInformationError ? "Retry public search" : "Find public information"}
              </Button>
              {publicInformationLoading && <p role="status" aria-live="polite" className="mb-0 mt-3 text-sm text-muted-foreground">Searching public sources. This can take a moment.</p>}
              {publicInformationError && <p role="alert" className="mb-0 mt-3 flex items-start gap-2 text-sm text-destructive"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{publicInformationError}</p>}
              {publicInformation && (
                <div className="mt-4 rounded-lg border border-border bg-card p-3 sm:p-4" aria-live="polite">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="m-0 text-sm font-semibold">{publicInformation.result.title}</h4>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{publicInformation.model}</span>
                  </div>
                  {publicInformation.result.status === "results" && <p className="mb-3 mt-0 whitespace-pre-wrap text-sm leading-relaxed">{publicInformation.result.summary}</p>}
                  {publicInformation.result.status === "no_results" && <p className="mb-3 mt-0 text-sm leading-relaxed text-muted-foreground">Search ran, but no useful public sources were returned. Try a more specific search focus.</p>}
                  {publicInformation.result.status === "ambiguous" && <div className="mb-3 rounded-lg bg-muted/60 p-3"><p className="m-0 text-sm leading-relaxed">{publicInformation.result.clarificationQuestion || "Several public people may match that name. Add a profession, organization, location, or official identifier and search again."}</p></div>}
                  {publicInformation.result.status === "unavailable" && <p className="mb-3 mt-0 text-sm leading-relaxed text-muted-foreground">Search grounding did not run, so Rocky did not retrieve or verify public information. Ask your administrator to check Meta search access.</p>}
                  {analysis.result.category === "person" && publicInformation.result.status !== "unavailable" && <p className="mb-3 mt-0 text-xs leading-relaxed text-muted-foreground">These pages have not been matched to the person in your photo. A name or appearance alone does not verify an account or identity.</p>}
                  {publicInformation.result.sources.length > 0 && (
                    <div className="grid gap-2" aria-label="Public source links">
                      {publicInformation.result.sources.map((source) => (
                        <article key={source.url} className="rounded-lg border border-border p-3">
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80">
                            <span>{source.title}</span><ExternalLink size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                          </a>
                          <p className="mb-0 mt-1 text-xs text-muted-foreground">{source.publisher} · {source.citationStatus === "cited_in_summary" ? "Cited in summary" : "Search result, not cited"} · Retrieved {new Date(source.retrievedAt).toLocaleString()}</p>
                          {source.snippet && <p className="mb-0 mt-2 text-sm leading-relaxed text-muted-foreground">{source.snippet}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </Card>
        </>
      )}

      <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"><ArrowLeft size={15} aria-hidden="true" />Back to Home</Link>
    </div>
  )
}
