"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { AlertCircle, Camera, Check, LoaderCircle, ScanSearch, ShieldCheck, Square, X } from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { analyzeVisionImage, type VisionAnalysisResult } from "@/lib/api/vision"
import { useAwarenessStore } from "@/stores/awareness-store"

const MAX_CAPTURE_EDGE = 1_600
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type VisionTask = "understanding" | "segmentation"

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function VisualAwareness() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const imageUrlRef = useRef<string | undefined>(undefined)
  const requestRef = useRef<AbortController | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [image, setImage] = useState<Blob>()
  const [imageUrl, setImageUrl] = useState("")
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>()
  const [task, setTask] = useState<VisionTask>("understanding")
  const [prompt, setPrompt] = useState("Describe the visible scene.")
  const [result, setResult] = useState<VisionAnalysisResult>()
  const [error, setError] = useState("")
  const setLatestVisionObservation = useAwarenessStore((store) => store.setLatestVisionObservation)

  const stopCamera = useCallback(() => {
    stopTracks(streamRef.current)
    streamRef.current = null
    setIsCameraActive(false)
  }, [])

  const clearImage = useCallback(() => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    imageUrlRef.current = undefined
    setImage(undefined)
    setImageUrl("")
    setImageDimensions(undefined)
    setResult(undefined)
  }, [])

  const closeDialog = useCallback(() => {
    stopCamera()
    requestRef.current?.abort()
    requestRef.current = null
    setIsAnalyzing(false)
    clearImage()
    setError("")
    if (dialogRef.current?.open) dialogRef.current.close()
    setIsOpen(false)
  }, [clearImage, stopCamera])

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return
    const dialog = dialogRef.current
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isCameraActive || !videoRef.current || !streamRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    void video.play().catch(() => {
      setError("Camera preview could not start. Check your browser permissions and try again.")
      stopCamera()
    })
    return () => {
      video.srcObject = null
    }
  }, [isCameraActive, stopCamera])

  useEffect(() => {
    return () => {
      stopTracks(streamRef.current)
      requestRef.current?.abort()
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    }
  }, [])

  const startCamera = async () => {
    if (isStartingCamera || isCameraActive) return
    setError("")
    setIsStartingCamera(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera capture is not supported in this browser. You can continue without it.")
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: MAX_CAPTURE_EDGE },
          height: { ideal: MAX_CAPTURE_EDGE },
        },
      })
      if (!dialogRef.current?.open) {
        stopTracks(stream)
        return
      }
      streamRef.current = stream
      setIsCameraActive(true)
    } catch (caught) {
      setError(
        caught instanceof Error && caught.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings, or close this window."
          : "Could not start the camera. Check that a camera is connected and try again.",
      )
    } finally {
      setIsStartingCamera(false)
    }
  }

  const captureStill = async () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet. Wait for the preview and try again.")
      return
    }

    const scale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) {
      setError("Could not prepare the still image. Please try again.")
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    stopCamera()
    setError("")
    const capturedImage = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.84),
    )
    if (!capturedImage) {
      setError("Could not prepare the still image. Please try again.")
      return
    }
    if (capturedImage.size > MAX_IMAGE_BYTES) {
      setError("The still image is larger than 5 MB. Please try again.")
      return
    }

    clearImage()
    const previewUrl = URL.createObjectURL(capturedImage)
    imageUrlRef.current = previewUrl
    setImage(capturedImage)
    setImageUrl(previewUrl)
    setImageDimensions({ width: canvas.width, height: canvas.height })
    setResult(undefined)
  }

  const analyzeImage = async () => {
    if (!image || !prompt.trim() || isAnalyzing) return
    const controller = new AbortController()
    requestRef.current = controller
    setIsAnalyzing(true)
    setError("")
    setResult(undefined)
    try {
      const analysis = await analyzeVisionImage(image, task, prompt.trim(), controller.signal)
      if (requestRef.current === controller) {
        setResult(analysis)
        if (analysis.kind === "understanding") setLatestVisionObservation(analysis.text)
      }
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(
        caught instanceof Error
          ? caught.message
          : "Image analysis failed. Please try again.",
      )
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setIsAnalyzing(false)
      }
    }
  }

  const cancelAnalysis = () => {
    requestRef.current?.abort()
    requestRef.current = null
    setIsAnalyzing(false)
  }

  const selectTask = (nextTask: VisionTask) => {
    setTask(nextTask)
    setPrompt(nextTask === "understanding" ? "Describe the visible scene." : "chair")
    setResult(undefined)
  }

  const segmentationResult = result?.kind === "segmentation" ? result : undefined

  return (
    <>
      <Card className="visual-awareness-card gap-0 ring-0">
        <CardHeader className="visual-awareness-header">
          <div className="visual-awareness-icon"><Camera size={17} /></div>
          <div className="visual-awareness-copy">
            <CardTitle>Visual awareness</CardTitle>
            <CardDescription>Choose when ROCKY can look at one still image.</CardDescription>
          </div>
          <Badge variant="outline" className="visual-awareness-badge">Still image only</Badge>
        </CardHeader>
        <CardContent className="visual-awareness-content">
          <p>Camera stays off until you start it. Review each capture before sending it for analysis. ROCKY does not save images.</p>
          <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
            <Camera size={15} /> Open camera
          </Button>
        </CardContent>
      </Card>

      <dialog
        ref={dialogRef}
        className="visual-dialog"
        aria-labelledby="visual-dialog-title"
        onCancel={(event) => {
          event.preventDefault()
          closeDialog()
        }}
        onClose={() => {
          stopCamera()
          setIsOpen(false)
        }}
      >
        <Card className="visual-dialog-card gap-0 ring-0">
          <CardHeader className="visual-dialog-header">
            <div>
              <CardTitle id="visual-dialog-title">A moment in view</CardTitle>
              <CardDescription>Capture one image, review it, then choose whether to send it to Meta.</CardDescription>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={closeDialog} aria-label="Close visual awareness">
              <X />
            </Button>
          </CardHeader>
          <CardContent className="visual-dialog-content">
            <div className="visual-privacy-note">
              <ShieldCheck size={16} />
              <span>Camera permission is requested only when you press Start camera. No image is stored by ROCKY.</span>
            </div>

            {isCameraActive ? (
              <div className="camera-preview">
                <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" />
                <div className="camera-active-indicator"><span /> Camera active</div>
              </div>
            ) : imageUrl ? (
              <div className="camera-preview image-preview">
                {imageDimensions && (
                  <Image
                    src={imageUrl}
                    alt="Still image captured for review"
                    width={imageDimensions.width}
                    height={imageDimensions.height}
                    unoptimized
                  />
                )}
                {segmentationResult?.boxes.map((box, index) => (
                  <div
                    className="vision-bounding-box"
                    key={`${box.objectId}-${index}`}
                    style={{
                      left: `${((box.width - box.x2) / box.width) * 100}%`,
                      top: `${(box.y1 / box.height) * 100}%`,
                      width: `${((box.x2 - box.x1) / box.width) * 100}%`,
                      height: `${((box.y2 - box.y1) / box.height) * 100}%`,
                    }}
                  >
                    <span>Object {box.objectId}</span>
                  </div>
                ))}
                <div className="image-review-indicator"><Check size={13} /> Review before sending</div>
              </div>
            ) : (
              <div className="camera-placeholder">
                <Camera size={25} />
                <span>Your camera is off</span>
                <span>Start the camera when you are ready. Nothing is captured automatically.</span>
              </div>
            )}

            {error && (
              <div className="vision-error" role="alert">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="vision-task-picker" aria-label="Choose image analysis">
              <Button
                type="button"
                variant={task === "understanding" ? "secondary" : "outline"}
                aria-pressed={task === "understanding"}
                onClick={() => selectTask("understanding")}
              >
                Ask about image · Muse Spark
              </Button>
              <Button
                type="button"
                variant={task === "segmentation" ? "secondary" : "outline"}
                aria-pressed={task === "segmentation"}
                onClick={() => selectTask("segmentation")}
              >
                Find an object · SAM 3.1
              </Button>
            </div>
            <label className="vision-prompt-label" htmlFor="vision-prompt">
              {task === "understanding" ? "What would you like to know?" : "Name one object to find"}
            </label>
            <Textarea
              id="vision-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={task === "understanding" ? 500 : 120}
              placeholder={task === "understanding" ? "Ask a question about what is visible…" : "For example: a red cup"}
              disabled={isAnalyzing}
              rows={2}
            />
            {task === "segmentation" && (
              <p className="vision-helper">SAM 3.1 works best with one short noun phrase, such as “glasses” or “red cup”. It returns object regions and boxes, not identities.</p>
            )}

            {result?.kind === "understanding" && (
              <div className="vision-result" aria-live="polite">
                <div className="vision-result-heading"><Badge variant="outline">Muse Spark</Badge><span>Image understanding</span></div>
                <div className="vision-result-text"><ReactMarkdown>{result.text}</ReactMarkdown></div>
              </div>
            )}
            {segmentationResult && (
              <div className="vision-result" aria-live="polite">
                <div className="vision-result-heading"><Badge variant="outline">SAM 3.1</Badge><span>Object segmentation</span></div>
                <p>
                  {segmentationResult.boxes.length
                    ? `SAM 3.1 returned ${segmentationResult.boxes.length} matching ${segmentationResult.boxes.length === 1 ? "object region" : "object regions"}. Bounding boxes are shown; pixel masks are not rendered in this preview.`
                    : "SAM 3.1 found no matching objects for that prompt."}
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="vision-processing" role="status">
                <LoaderCircle size={15} className="animate-spin" /> Sending image to Meta for analysis…
              </div>
            )}

            <div className="visual-dialog-actions">
              {isCameraActive ? (
                <>
                  <Button type="button" variant="outline" onClick={stopCamera}>
                    <Square size={14} /> Stop camera
                  </Button>
                  <Button type="button" onClick={() => void captureStill()}>
                    <Camera size={15} /> Capture still
                  </Button>
                </>
              ) : image ? (
                <>
                  <Button type="button" variant="outline" onClick={() => { clearImage(); setError("") }} disabled={isAnalyzing}>
                    <X size={14} /> Discard image
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { clearImage(); setError(""); void startCamera() }} disabled={isStartingCamera || isAnalyzing}>
                    {isStartingCamera ? <LoaderCircle size={15} className="animate-spin" /> : <Camera size={15} />}
                    Retake
                  </Button>
                  <Button type="button" onClick={() => void analyzeImage()} disabled={!prompt.trim() || isAnalyzing}>
                    {isAnalyzing ? <LoaderCircle size={15} className="animate-spin" /> : <ScanSearch size={15} />}
                    {isAnalyzing ? "Analyzing…" : task === "understanding" ? "Send to Muse Spark" : "Send to SAM 3.1"}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => void startCamera()} disabled={isStartingCamera}>
                  {isStartingCamera ? <LoaderCircle size={15} className="animate-spin" /> : <Camera size={15} />}
                  {isStartingCamera ? "Starting camera…" : "Start camera"}
                </Button>
              )}
              {isAnalyzing && (
                <Button type="button" variant="ghost" onClick={cancelAnalysis}>Cancel analysis</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </dialog>
    </>
  )
}
