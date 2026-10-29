"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { AlertCircle, ArrowLeft, Camera, Check, ImagePlus, LoaderCircle, RotateCcw, ScanEye, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  cameraAccessErrorMessage,
  requestVisualCamera,
  uploadVisualImage,
  validateVisualImageFile,
  VisualImageValidationError,
  type UploadProgress,
  type VisualAnalysisResponse,
} from "@/lib/visual-intelligence-client"

type SubmitState = "idle" | "uploading" | "analyzing" | "success" | "error"

export function VisualIntelligenceForm() {
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState("")
  const [cameraActive, setCameraActive] = useState(false)
  const [state, setState] = useState<SubmitState>("idle")
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState("")
  const [analysis, setAnalysis] = useState<VisualAnalysisResponse | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [cameraMessage, setCameraMessage] = useState("")
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
    setProgress({ loaded: 0, total: file.size, percent: 0 })
    setState("uploading")
    try {
      const response = await uploadVisualImage(file, question, (nextProgress) => {
        setProgress(nextProgress)
        if (nextProgress.percent >= 100) setState("analyzing")
      })
      setAnalysis(response.analysis)
      setState("success")
    } catch (uploadError) {
      setState("error")
      setError(uploadError instanceof Error ? uploadError.message : "Rocky could not analyze this image. Try again.")
    }
  }

  const busy = state === "uploading" || state === "analyzing"

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
        <Card className="gap-0 border border-border p-4 ring-0 sm:p-6" aria-live="polite">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Check size={18} aria-hidden="true" /></span>
            <div><span className="eyebrow">ROCKY&apos;S ANALYSIS</span><h2 className="mb-0 mt-1 text-lg font-medium">{analysis.result.subject}</h2></div>
          </div>
          <p className="m-0 text-sm leading-relaxed">{analysis.result.shortDescription}</p>
          {analysis.result.visualDetails.length > 0 && (
            <ul className="mb-0 mt-4 grid gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {analysis.result.visualDetails.map((detail, index) => <li key={`${index}-${detail}`}>{detail}</li>)}
            </ul>
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
        </Card>
      )}

      <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"><ArrowLeft size={15} aria-hidden="true" />Back to Home</Link>
    </div>
  )
}
