import { apiRequest } from "@/lib/api/client"

export function transcribeVoiceRecording(audio: Blob, signal?: AbortSignal) {
  const formData = new FormData()
  formData.append("audio", audio, "recording.wav")
  return apiRequest<{ transcript: string }>("/api/voice/transcribe", {
    method: "POST",
    body: formData,
    signal,
  })
}
