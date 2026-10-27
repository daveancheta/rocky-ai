"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Check, ChevronRight, Eye, Moon, Sun, Monitor, ShieldCheck, Sparkles, Volume2 } from "lucide-react"
import { useSettingsStore, type Appearance } from "@/stores/settings-store"
import { useMemoryStore } from "@/stores/memory-store"
import { getMemoryPreference, updateMemoryPreference } from "@/lib/api/memories"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { canUseSpeechSynthesis, speakCompanionText, stopCompanionSpeech } from "@/lib/voice/speech-controller"

const appearances: Array<{ value: Appearance; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]
function PreferenceToggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Switch className="setting-switch data-checked:bg-primary" checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} />
  )
}

export default function SettingsPage() {
  const appearance = useSettingsStore((store) => store.appearance)
  const setAppearance = useSettingsStore((store) => store.setAppearance)
  const memoryEnabled = useSettingsStore((store) => store.memoryEnabled)
  const setMemoryEnabled = useSettingsStore((store) => store.setMemoryEnabled)
  const cameraMonitoring = useSettingsStore((store) => store.cameraMonitoring)
  const setCameraMonitoring = useSettingsStore((store) => store.setCameraMonitoring)
  const proactiveEnabled = useSettingsStore((store) => store.proactiveEnabled)
  const setProactiveEnabled = useSettingsStore((store) => store.setProactiveEnabled)
  const speakProactive = useSettingsStore((store) => store.speakProactive)
  const setSpeakProactive = useSettingsStore((store) => store.setSpeakProactive)
  const speakReplies = useSettingsStore((store) => store.speakReplies)
  const setSpeakReplies = useSettingsStore((store) => store.setSpeakReplies)
  const speechVoiceURI = useSettingsStore((store) => store.speechVoiceURI)
  const setSpeechVoiceURI = useSettingsStore((store) => store.setSpeechVoiceURI)
  const speechRate = useSettingsStore((store) => store.speechRate)
  const setSpeechRate = useSettingsStore((store) => store.setSpeechRate)
  const quietHoursEnabled = useSettingsStore((store) => store.quietHoursEnabled)
  const setQuietHoursEnabled = useSettingsStore((store) => store.setQuietHoursEnabled)
  const quietHoursStart = useSettingsStore((store) => store.quietHoursStart)
  const setQuietHoursStart = useSettingsStore((store) => store.setQuietHoursStart)
  const quietHoursEnd = useSettingsStore((store) => store.quietHoursEnd)
  const setQuietHoursEnd = useSettingsStore((store) => store.setQuietHoursEnd)
  const clearMemories = useMemoryStore((store) => store.clear)
  const [cleared, setCleared] = useState(false)
  const [memoryPreferenceLoading, setMemoryPreferenceLoading] = useState(true)
  const [memoryPreferenceError, setMemoryPreferenceError] = useState<string>()
  const [isClearingMemories, setIsClearingMemories] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceTestState, setVoiceTestState] = useState<"idle" | "playing" | "unavailable">("idle")
  const [voiceTestError, setVoiceTestError] = useState<string>()
  const [speechSupported, setSpeechSupported] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const supported = canUseSpeechSynthesis()
    if (!supported) return
    queueMicrotask(() => {
      if (mountedRef.current) setSpeechSupported(true)
    })
    const updateVoices = () => setAvailableVoices(window.speechSynthesis.getVoices())
    updateVoices()
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices)
    return () => {
      mountedRef.current = false
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices)
      stopCompanionSpeech("test")
    }
  }, [])

  const testVoice = () => {
    if (voiceTestState === "playing") {
      stopCompanionSpeech("test")
      setVoiceTestState("idle")
      return
    }
    setVoiceTestError(undefined)
    const started = speakCompanionText("Hello, I’m Rocky. This is how my voice will sound.", {
      owner: "test",
      voiceURI: speechVoiceURI,
      rate: speechRate,
      onStart: () => { if (mountedRef.current) setVoiceTestState("playing") },
      onEnd: () => { if (mountedRef.current) setVoiceTestState("idle") },
      onError: () => {
        if (mountedRef.current) {
          setVoiceTestState("unavailable")
          setVoiceTestError("The browser could not play the selected voice.")
        }
      },
    })
    if (!started) {
      setVoiceTestState("unavailable")
      setVoiceTestError("Speech could not start. Check browser audio support or stop other playback and try again.")
    }
  }

  useEffect(() => {
    let active = true
    void getMemoryPreference()
      .then(({ enabled }) => {
        if (active) setMemoryEnabled(enabled)
      })
      .catch(() => {
        if (active) setMemoryPreferenceError("Could not load the saved memory preference.")
      })
      .finally(() => {
        if (active) setMemoryPreferenceLoading(false)
      })
    return () => {
      active = false
    }
  }, [setMemoryEnabled])

  const saveMemoryPreference = async (enabled: boolean) => {
    setMemoryPreferenceError(undefined)
    try {
      await updateMemoryPreference(enabled)
      setMemoryEnabled(enabled)
    } catch (error) {
      setMemoryPreferenceError(
        error instanceof Error ? error.message : "Memory preference could not be saved.",
      )
    }
  }

  const handleClearMemories = async () => {
    setIsClearingMemories(true)
    setMemoryPreferenceError(undefined)
    try {
      await clearMemories()
      setCleared(true)
    } catch (error) {
      setMemoryPreferenceError(
        error instanceof Error ? error.message : "Memories could not be cleared.",
      )
    } finally {
      setIsClearingMemories(false)
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">MAKE ROCKY FEEL LIKE YOURS</span>
          <h1>Settings<span className="heading-period">.</span></h1>
          <p>A few thoughtful choices. Change them whenever you like.</p>
        </div>
      </header>

      <Card role="region" aria-labelledby="appearance-heading" className="settings-section gap-0 ring-0">
        <div className="settings-section-heading"><span className="settings-section-icon"><Sun size={17} /></span><div><h2 id="appearance-heading">Appearance</h2><p>A comfortable look for every moment.</p></div></div>
        <div className="appearance-options" role="group" aria-label="Appearance">
          {appearances.map(({ value, label, icon: Icon }) => (
            <Button type="button" variant={appearance === value ? "secondary" : "outline"} key={value} className={`appearance-option ${appearance === value ? "selected" : ""}`} onClick={() => setAppearance(value)} aria-pressed={appearance === value}>
              <Icon size={17} /><span>{label}</span>{appearance === value && <Check size={15} className="appearance-check" />}
            </Button>
          ))}
        </div>
        <p className="settings-hint">Dark mode is available. System follows your device preference.</p>
      </Card>

      <Card role="region" aria-labelledby="companion-behavior-heading" className="settings-section gap-0 ring-0">
        <div className="settings-section-heading"><span className="settings-section-icon"><Sparkles size={17} /></span><div><h2 id="companion-behavior-heading">Companion behavior</h2><p>Rocky checks in only when current context may be useful.</p></div></div>
        <div className="setting-row">
          <div><strong>Proactive check-ins</strong><span>Allow Rocky to show a relevant check-in during an active companion session.</span></div>
          <PreferenceToggle checked={proactiveEnabled} onChange={setProactiveEnabled} label="Enable proactive check-ins" />
        </div>
        <div className="setting-row">
          <div className="setting-row-icon"><Volume2 size={17} /><div><strong>Speak check-ins aloud</strong><span>Uses browser speech synthesis when available. Messages still appear if speech is unavailable or busy.</span></div></div>
          <PreferenceToggle checked={speakProactive} onChange={setSpeakProactive} label="Speak proactive check-ins aloud" disabled={!proactiveEnabled} />
        </div>
        <div className="setting-row">
          <div><strong>Quiet hours</strong><span>Rocky stays quiet during the selected local time range.</span></div>
          <PreferenceToggle checked={quietHoursEnabled} onChange={setQuietHoursEnabled} label="Enable quiet hours" disabled={!proactiveEnabled} />
        </div>
        {quietHoursEnabled && <div className="quiet-hours-row">
          <label>From <input type="time" value={quietHoursStart} onChange={(event) => setQuietHoursStart(event.target.value)} aria-label="Quiet hours start" /></label>
          <label>Until <input type="time" value={quietHoursEnd} onChange={(event) => setQuietHoursEnd(event.target.value)} aria-label="Quiet hours end" /></label>
        </div>}
      </Card>

      <Card role="region" aria-labelledby="voice-heading" className="settings-section gap-0 ring-0">
        <div className="settings-section-heading"><span className="settings-section-icon"><Volume2 size={17} /></span><div><h2 id="voice-heading">Voice</h2><p>Choose how ROCKY responds aloud on this device.</p></div></div>
        <div className="setting-row">
          <div><strong>Voice replies</strong><span>Automatically speak ROCKY&apos;s actual chat responses when browser speech is supported.</span></div>
          <PreferenceToggle checked={speakReplies} onChange={setSpeakReplies} label="Enable voice replies" />
        </div>
        <div className="setting-row voice-setting-control">
          <label htmlFor="rocky-speech-voice"><strong>Voice</strong><span>Only voices provided by your browser are listed.</span></label>
          <select id="rocky-speech-voice" className="voice-setting-select" value={speechVoiceURI} onChange={(event) => setSpeechVoiceURI(event.target.value)} disabled={!speechSupported || availableVoices.length === 0}>
            <option value="">Device default</option>
            {availableVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.default ? " · default" : ""}</option>)}
          </select>
        </div>
        <div className="setting-row voice-setting-control">
          <label htmlFor="rocky-speech-rate"><strong>Speech speed</strong><span>{speechRate.toFixed(2)}×</span></label>
          <input id="rocky-speech-rate" className="voice-setting-rate" type="range" min="0.75" max="1.5" step="0.05" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} disabled={!speechSupported} />
        </div>
        <div className="setting-row voice-test-row">
          <div><strong>Test Voice</strong><span>{voiceTestError ?? (speechSupported ? "Plays a short sample using your current voice and speed." : "Speech synthesis is not available in this browser.")}</span></div>
          <Button type="button" variant="outline" onClick={testVoice} disabled={!speechSupported}>{voiceTestState === "playing" ? "Stop test" : "Test Voice"}</Button>
        </div>
        <p className="settings-hint">Hands-free listening is not supported by ROCKY&apos;s current push-to-talk transcription service.</p>
      </Card>

      <Card role="region" aria-labelledby="devices-heading" className="settings-section gap-0 ring-0">
        <div className="settings-section-heading"><span className="settings-section-icon"><Eye size={17} /></span><div><h2 id="devices-heading">Camera</h2><p>Browser access is requested only from an active companion session.</p></div></div>
        <div className="setting-row">
          <div className="setting-row-icon"><Eye size={17} /><div><strong>Allow camera during companion mode</strong><span>When enabled here, starting a session requests camera access and analyzes a still frame about once a minute. Frames aren&apos;t saved.</span></div></div>
          <PreferenceToggle checked={cameraMonitoring} onChange={setCameraMonitoring} label="Allow camera monitoring during companion mode" />
        </div>
      </Card>

      <Card role="region" aria-labelledby="privacy-heading" className="settings-section gap-0 ring-0">
        <div className="settings-section-heading"><span className="settings-section-icon"><ShieldCheck size={17} /></span><div><h2 id="privacy-heading">Memory & privacy</h2><p>You stay in control of what Rocky remembers.</p></div></div>
        <div className="setting-row">
          <div><strong>Use approved memories</strong><span>When off, saved memories stay stored but are not included in AI requests or suggestion generation.</span></div>
          <PreferenceToggle checked={memoryEnabled} onChange={(enabled) => void saveMemoryPreference(enabled)} label="Use approved memories" disabled={memoryPreferenceLoading} />
        </div>
        {memoryPreferenceError && <p className="settings-memory-error" role="alert">{memoryPreferenceError}</p>}
        <Link href="/memories" className="setting-row setting-link">
          <div><strong>Review saved memories</strong><span>Review, edit, or remove information Rocky may use. Nothing from chat is saved automatically.</span></div><ChevronRight size={17} />
        </Link>
        <div className="setting-row">
          <div><strong>Delete all saved memories</strong><span>{cleared ? "All saved memories were deleted." : "Permanently remove every saved memory for this browser."}</span></div>
          <Button variant="destructive" size="sm" disabled={isClearingMemories} onClick={() => void handleClearMemories()}>{isClearingMemories ? "Deleting…" : cleared ? "Delete again" : "Delete all"}</Button>
        </div>
        <Card className="privacy-callout gap-0 ring-0"><ShieldCheck size={16} /><p>Approved memories and this preference are stored in Neon. Memory use is off when disabled. This app has no sign-in yet, so the HttpOnly browser cookie scopes access; it is not account authentication or cross-device isolation.</p></Card>
      </Card>
      <div className="settings-footer"><span><Check size={14} /> Your preferences are saved in this browser</span><span>ROCKY · UI DEMO</span></div>
    </div>
  )
}
