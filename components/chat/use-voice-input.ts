"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { transcribeVoiceRecording } from "@/lib/api/voice"
import { encodeMonoPcmWav } from "@/lib/audio/wav"
import { hasUtteranceEnded, hasVoiceActivity, measureAudioRms } from "@/lib/audio/voice-activity"
import { stopCompanionSpeech } from "@/lib/voice/speech-controller"

const MAX_RECORDING_MS = 120_000
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const VAD_CALIBRATION_MS = 350
const PREROLL_CHUNKS = 8

type VoiceStatus = "idle" | "requesting" | "recording" | "processing"

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function useVoiceInput(onTranscript: (transcript: string) => void, autoListen = false) {
  const [status, setStatus] = useState<VoiceStatus>("idle")
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState("")
  const statusRef = useRef<VoiceStatus>("idle")
  const actionIdRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const sampleChunksRef = useRef<Float32Array[]>([])
  const prerollChunksRef = useRef<Float32Array[]>([])
  const voiceDetectedRef = useRef(false)
  const noiseFloorRef = useRef(0.002)
  const lastVoiceActivityAtRef = useRef(0)
  const automaticRecordingRef = useRef(false)
  const startedAtRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const changeStatus = useCallback((next: VoiceStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const releaseRecording = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    intervalRef.current = null
    timeoutRef.current = null

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null
      processorRef.current.disconnect()
      processorRef.current = null
    }
    sourceRef.current?.disconnect()
    sourceRef.current = null
    gainRef.current?.disconnect()
    gainRef.current = null
    stopTracks(streamRef.current)
    streamRef.current = null
    if (contextRef.current && contextRef.current.state !== "closed") {
      void contextRef.current.close()
    }
    contextRef.current = null
  }, [])

  const stopRecording = useCallback(async () => {
    if (statusRef.current !== "recording") return
    actionIdRef.current += 1
    const samples = sampleChunksRef.current
    sampleChunksRef.current = []
    voiceDetectedRef.current = false
    prerollChunksRef.current = []
    const sampleRate = contextRef.current?.sampleRate ?? 0
    releaseRecording()
    setRecordingSeconds(0)
    changeStatus("processing")
    setError("")

    let audio: Blob
    try {
      audio = encodeMonoPcmWav(samples, sampleRate)
    } catch (caught) {
      changeStatus("idle")
      setError(caught instanceof Error ? caught.message : "The recording could not be prepared.")
      return
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      changeStatus("idle")
      setError("This recording is too large to transcribe. Please record a shorter clip.")
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    const requestId = actionIdRef.current
    try {
      const result = await transcribeVoiceRecording(audio, controller.signal)
      if (requestId !== actionIdRef.current || !mountedRef.current) return
      const normalizedTranscript = result.transcript.trim()
      if (!normalizedTranscript) {
        setError("No speech was recognized. Try again and speak clearly.")
        changeStatus("idle")
        return
      }
      setTranscript(normalizedTranscript)
      onTranscript(normalizedTranscript)
      changeStatus("idle")
    } catch (caught) {
      if (controller.signal.aborted || requestId !== actionIdRef.current) return
      setError(
        caught instanceof Error
          ? caught.message
          : "Transcription failed. Please try recording again.",
      )
      changeStatus("idle")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [changeStatus, onTranscript, releaseRecording])

  const cancel = useCallback(() => {
    actionIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    sampleChunksRef.current = []
    prerollChunksRef.current = []
    voiceDetectedRef.current = false
    automaticRecordingRef.current = false
    releaseRecording()
    setRecordingSeconds(0)
    setTranscript("")
    setError("")
    changeStatus("idle")
  }, [changeStatus, releaseRecording])

  const startRecording = useCallback(async () => {
    if (statusRef.current !== "idle") return
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone recording is not supported in this browser.")
      return
    }

    const actionId = actionIdRef.current + 1
    actionIdRef.current = actionId
    sampleChunksRef.current = []
    prerollChunksRef.current = []
    voiceDetectedRef.current = false
    noiseFloorRef.current = 0.002
    automaticRecordingRef.current = autoListen
    setTranscript("")
    setError("")
    if (!autoListen) stopCompanionSpeech()
    changeStatus("requesting")

    let stream: MediaStream | null = null
    try {
      const context = new AudioContext()
      contextRef.current = context
      const resumeAudio = context.resume()
      const requestMicrophone = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      stream = await requestMicrophone
      if (actionId !== actionIdRef.current || !mountedRef.current) {
        stopTracks(stream)
        if (context.state !== "closed") void context.close()
        return
      }

      streamRef.current = stream
      await resumeAudio
      if (actionId !== actionIdRef.current || !mountedRef.current) {
        stopTracks(stream)
        if (context.state !== "closed") void context.close()
        return
      }
      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const gain = context.createGain()
      gain.gain.value = 0
      sourceRef.current = source
      processorRef.current = processor
      gainRef.current = gain
      processor.onaudioprocess = (event) => {
        const samples = new Float32Array(event.inputBuffer.getChannelData(0))
        if (!autoListen) {
          sampleChunksRef.current.push(samples)
          return
        }

        const now = Date.now()
        const rms = measureAudioRms(samples)
        if (!voiceDetectedRef.current) {
          if (now - startedAtRef.current < VAD_CALIBRATION_MS) {
            noiseFloorRef.current = noiseFloorRef.current * 0.85 + rms * 0.15
          } else if (hasVoiceActivity(rms, noiseFloorRef.current)) {
            voiceDetectedRef.current = true
            lastVoiceActivityAtRef.current = now
            sampleChunksRef.current = [...prerollChunksRef.current, samples]
            prerollChunksRef.current = []
            return
          } else {
            noiseFloorRef.current = noiseFloorRef.current * 0.94 + rms * 0.06
          }

          prerollChunksRef.current.push(samples)
          if (prerollChunksRef.current.length > PREROLL_CHUNKS) prerollChunksRef.current.shift()
          return
        }

        sampleChunksRef.current.push(samples)
        if (hasVoiceActivity(rms, noiseFloorRef.current)) lastVoiceActivityAtRef.current = now
        else if (hasUtteranceEnded(true, lastVoiceActivityAtRef.current, now)) void stopRecording()
      }
      source.connect(processor)
      processor.connect(gain)
      gain.connect(context.destination)
      startedAtRef.current = Date.now()
      changeStatus("recording")
      if (!autoListen) {
        intervalRef.current = setInterval(() => {
          setRecordingSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
        }, 250)
      }
      const enforceMaximumDuration = () => {
        if (autoListen && !voiceDetectedRef.current) {
          timeoutRef.current = setTimeout(enforceMaximumDuration, MAX_RECORDING_MS)
          return
        }
        void stopRecording()
      }
      timeoutRef.current = setTimeout(enforceMaximumDuration, MAX_RECORDING_MS)
    } catch (caught) {
      if (stream) stopTracks(stream)
      releaseRecording()
      if (actionId === actionIdRef.current && mountedRef.current) {
        changeStatus("idle")
        setError(
          caught instanceof Error && caught.name === "NotAllowedError"
            ? "Microphone access was denied. Allow it in your browser settings to use voice input."
            : "Could not start microphone recording. Check your browser permissions and try again.",
        )
      }
    }
  }, [autoListen, changeStatus, releaseRecording, stopRecording])

  const clearTranscript = useCallback(() => {
    setTranscript("")
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancel()
      else if (autoListen && statusRef.current === "idle" && !error) void startRecording()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [autoListen, cancel, error, startRecording])

  useEffect(() => {
    if (autoListen && status === "idle" && !error && document.visibilityState === "visible") {
      let active = true
      queueMicrotask(() => {
        if (active && statusRef.current === "idle") void startRecording()
      })
      return () => { active = false }
    }
    if (!autoListen && automaticRecordingRef.current && status === "recording") {
      let active = true
      queueMicrotask(() => {
        if (active && statusRef.current === "recording") cancel()
      })
      return () => { active = false }
    }
  }, [autoListen, cancel, error, startRecording, status])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      actionIdRef.current += 1
      abortRef.current?.abort()
      releaseRecording()
    }
  }, [releaseRecording])

  return {
    status,
    recordingSeconds,
    transcript,
    error,
    startRecording,
    stopRecording,
    cancel,
    clearTranscript,
  }
}
