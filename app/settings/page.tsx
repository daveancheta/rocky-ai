"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AudioLines, Check, ChevronRight, Eye, Mic, Moon, Sun, Monitor, ShieldCheck, Volume2 } from "lucide-react"
import { useSettingsStore, type Appearance, type Personality } from "@/stores/settings-store"
import { useAwarenessStore } from "@/stores/awareness-store"
import { useMemoryStore } from "@/stores/memory-store"
import { getMemoryPreference, updateMemoryPreference } from "@/lib/api/memories"

const appearances: Array<{ value: Appearance; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]
const personalities: Personality[] = ["Calm", "Friendly", "Playful", "Supportive"]

function PreferenceToggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button className={`toggle ${checked ? "on" : ""}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

export default function SettingsPage() {
  const appearance = useSettingsStore((store) => store.appearance)
  const setAppearance = useSettingsStore((store) => store.setAppearance)
  const personality = useSettingsStore((store) => store.personality)
  const setPersonality = useSettingsStore((store) => store.setPersonality)
  const quietMode = useSettingsStore((store) => store.quietMode)
  const setQuietMode = useSettingsStore((store) => store.setQuietMode)
  const interruptions = useSettingsStore((store) => store.interruptions)
  const setInterruptions = useSettingsStore((store) => store.setInterruptions)
  const memoryEnabled = useSettingsStore((store) => store.memoryEnabled)
  const setMemoryEnabled = useSettingsStore((store) => store.setMemoryEnabled)
  const isEnabled = useAwarenessStore((store) => store.isEnabled)
  const setAwarenessEnabled = useAwarenessStore((store) => store.setEnabled)
  const clearMemories = useMemoryStore((store) => store.clear)
  const [cleared, setCleared] = useState(false)
  const [memoryPreferenceLoading, setMemoryPreferenceLoading] = useState(true)
  const [memoryPreferenceError, setMemoryPreferenceError] = useState<string>()
  const [isClearingMemories, setIsClearingMemories] = useState(false)

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

      <section className="settings-section">
        <div className="settings-section-heading"><span className="settings-section-icon"><Sun size={17} /></span><div><h2>Appearance</h2><p>A comfortable look for every moment.</p></div></div>
        <div className="appearance-options" role="group" aria-label="Appearance">
          {appearances.map(({ value, label, icon: Icon }) => (
            <button key={value} className={`appearance-option ${appearance === value ? "selected" : ""}`} onClick={() => setAppearance(value)} aria-pressed={appearance === value}>
              <Icon size={17} /><span>{label}</span>{appearance === value && <Check size={15} className="appearance-check" />}
            </button>
          ))}
        </div>
        <p className="settings-hint">Dark mode is available. System follows your device preference.</p>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><span className="settings-section-icon"><AudioLines size={17} /></span><div><h2>Voice & personality</h2><p>Shape the way Rocky feels in conversation.</p></div></div>
        <div className="setting-row personality-row">
          <div><strong>Personality</strong><span>Choose a tone that feels right to you.</span></div>
          <div className="personality-options" role="group" aria-label="Personality">
            {personalities.map((item) => <button key={item} className={personality === item ? "selected" : ""} onClick={() => setPersonality(item)} aria-pressed={personality === item}>{item}</button>)}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-row-icon"><Volume2 size={17} /><div><strong>Voice</strong><span>Voice output is not connected in this demo.</span></div></div>
          <span className="coming-soon">Not connected</span>
        </div>
        <div className="setting-row">
          <div><strong>Quiet mode</strong><span>Keep Rocky&apos;s visual presence calm and still.</span></div>
          <PreferenceToggle checked={quietMode} onChange={setQuietMode} label="Quiet mode" />
        </div>
        <div className="setting-row">
          <div><strong>Interruptions</strong><span>How often should Rocky speak up?</span></div>
          <select className="setting-select" value={interruptions} onChange={(event) => setInterruptions(event.target.value as "gentle" | "only_when_needed")}>
            <option value="gentle">Gentle suggestions</option>
            <option value="only_when_needed">Only when asked</option>
          </select>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><span className="settings-section-icon"><Eye size={17} /></span><div><h2>Camera & microphone</h2><p>Your privacy comes first. Nothing is connected right now.</p></div></div>
        <div className="setting-row">
          <div className="setting-row-icon"><Mic size={17} /><div><strong>Microphone</strong><span>Audio capture and speech recognition are not available.</span></div></div>
          <span className="permission-status">Not connected</span>
        </div>
        <div className="setting-row">
          <div className="setting-row-icon"><Eye size={17} /><div><strong>Camera awareness</strong><span>No camera feed or environment analysis is active.</span></div></div>
          <PreferenceToggle checked={isEnabled} onChange={setAwarenessEnabled} label="Camera awareness demo state" />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><span className="settings-section-icon"><ShieldCheck size={17} /></span><div><h2>Memory & privacy</h2><p>You stay in control of what Rocky remembers.</p></div></div>
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
          <button className="text-button" disabled={isClearingMemories} onClick={() => void handleClearMemories()}>{isClearingMemories ? "Deleting…" : cleared ? "Delete again" : "Delete all"}</button>
        </div>
        <div className="privacy-callout"><ShieldCheck size={16} /><p>Approved memories and this preference are stored in Neon. Memory use is off when disabled. This app has no sign-in yet, so the HttpOnly browser cookie scopes access; it is not account authentication or cross-device isolation.</p></div>
      </section>
      <div className="settings-footer"><span><Check size={14} /> Your preferences are saved in this browser</span><span>ROCKY · UI DEMO</span></div>
    </div>
  )
}
