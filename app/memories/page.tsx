"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  LockKeyhole,
  X,
  Check,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getConversations } from "@/lib/api/chat"
import {
  getMemoryPreference,
  suggestMemories,
} from "@/lib/api/memories"
import { useMemoryStore } from "@/stores/memory-store"
import { useSettingsStore } from "@/stores/settings-store"
import { MEMORY_CATEGORIES, type MemoryCandidate, type MemoryCategory } from "@/types/memory"
import type { ConversationSummary } from "@/types/chat"

const categories: Array<MemoryCategory | "All"> = [
  "All",
  ...MEMORY_CATEGORIES,
]

export default function MemoriesPage() {
  const memories = useMemoryStore((store) => store.memories)
  const query = useMemoryStore((store) => store.query)
  const category = useMemoryStore((store) => store.category)
  const isLoading = useMemoryStore((store) => store.isLoading)
  const error = useMemoryStore((store) => store.error)
  const fetchMemories = useMemoryStore((store) => store.fetchMemories)
  const setQuery = useMemoryStore((store) => store.setQuery)
  const setCategory = useMemoryStore((store) => store.setCategory)
  const create = useMemoryStore((store) => store.create)
  const update = useMemoryStore((store) => store.update)
  const remove = useMemoryStore((store) => store.remove)
  const memoryEnabled = useSettingsStore((store) => store.memoryEnabled)
  const setMemoryEnabled = useSettingsStore((store) => store.setMemoryEnabled)
  const [editing, setEditing] = useState<string>()
  const [showNew, setShowNew] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [sourceConversationId, setSourceConversationId] = useState("")
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string>()
  const [suggestionNotice, setSuggestionNotice] = useState<string>()
  const [preferenceError, setPreferenceError] = useState<string>()
  const [isPreferenceLoaded, setIsPreferenceLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { conversations: loadedConversations } = await getConversations()
        if (active) {
          setConversations(loadedConversations)
          setSourceConversationId(loadedConversations[0]?.id ?? "")
        }
      } catch {
        if (active) setConversations([])
      }
      try {
        await fetchMemories()
      } catch {
        // The memory store exposes the API error in the page.
      }
      try {
        const preference = await getMemoryPreference()
        if (active) setMemoryEnabled(preference.enabled)
      } catch {
        if (active) setPreferenceError("Could not confirm your memory-use preference.")
      } finally {
        if (active) setIsPreferenceLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [fetchMemories, setMemoryEnabled])

  const visibleMemories = useMemo(() => memories.filter((memory) => {
    const matchesCategory = category === "All" || memory.category === category
    const searchText = `${memory.title} ${memory.detail} ${memory.category}`.toLowerCase()
    return matchesCategory && searchText.includes(query.toLowerCase())
  }), [category, memories, query])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const title = String(formData.get("title") ?? "").trim()
    const detail = String(formData.get("detail") ?? "").trim()
    const selectedCategory = String(formData.get("category") ?? "")
    if (!title || !detail || !MEMORY_CATEGORIES.includes(selectedCategory as MemoryCategory)) return

    try {
      await create({
        title,
        detail,
        category: selectedCategory as MemoryCategory,
      })
      form.reset()
      setShowNew(false)
    } catch {
      // The store exposes the API error in the page.
    }
  }

  const requestSuggestions = async () => {
    if (!sourceConversationId || !isPreferenceLoaded || !memoryEnabled || isSuggesting) return
    setIsSuggesting(true)
    setSuggestionError(undefined)
    setSuggestionNotice(undefined)
    try {
      const response = await suggestMemories(sourceConversationId)
      setCandidates(response.candidates)
      if (response.candidates.length === 0) {
        setSuggestionNotice("No suitable memory suggestions found in that conversation.")
      }
    } catch (error) {
      setSuggestionError(
        error instanceof Error ? error.message : "Memory suggestions are unavailable.",
      )
    } finally {
      setIsSuggesting(false)
    }
  }

  const approveCandidate = async (candidate: MemoryCandidate) => {
    try {
      await create({ ...candidate, sourceConversationId })
      setCandidates((current) => current.filter((item) => item !== candidate))
      setSuggestionNotice("Memory approved and saved. You can edit or remove it below.")
    } catch {
      // The store exposes the API error in the page.
    }
  }

  const handleUpdate = async (
    event: FormEvent<HTMLFormElement>,
    memoryId: string,
  ) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const title = String(formData.get("title") ?? "").trim()
    const detail = String(formData.get("detail") ?? "").trim()
    if (!title || !detail) return
    try {
      await update(memoryId, { title, detail })
      setEditing(undefined)
    } catch {
      // The store exposes the API error in the page.
    }
  }

  return (
    <div className="page memories-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">YOUR PERSONAL CONTEXT</span>
          <h1>Memories<span className="heading-period">.</span></h1>
          <p>Review and manage the details you choose to let Rocky remember.</p>
        </div>
        <Button className="primary-action" onClick={() => setShowNew((value) => !value)}>
          {showNew ? <X size={16} /> : <Plus size={16} />}
          {showNew ? "Cancel" : "Add a memory"}
        </Button>
      </header>

      <div className="memory-privacy">
        <span className="privacy-lock"><LockKeyhole size={16} /></span>
        <div>
          <strong>Only saved with your approval</strong>
          <p>
            Memories are stored in Neon for this browser. Approved, relevant memories may be
            included in a Muse Spark request. Rocky does not save chat messages as memories
            automatically.
          </p>
        </div>
        <span className="sample-label">USER CONTROLLED</span>
      </div>

      {preferenceError && <p className="memory-error" role="alert">{preferenceError}</p>}

      {showNew && (
        <form className="new-memory-form" onSubmit={(event) => void handleCreate(event)}>
          <div className="form-topline">
            <strong>Add a memory</strong>
            <span>Saving means you approve Rocky storing and using this detail.</span>
          </div>
          <div className="memory-form-grid">
            <input name="title" placeholder="A short title" aria-label="Memory title" required maxLength={80} />
            <select name="category" aria-label="Memory category" defaultValue="Preferences">
              {MEMORY_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input name="detail" placeholder="What would you like to remember?" aria-label="Memory detail" required maxLength={500} />
            <Button className="save-memory-button" type="submit"><Check size={15} /> Approve & save</Button>
          </div>
          <label className="memory-consent">
            <input type="checkbox" name="approval" required />
            <span>I approve storing this information as a memory. I can edit or delete it later.</span>
          </label>
        </form>
      )}

      <section className="memory-suggestions" aria-labelledby="memory-suggestions-title">
        <div>
          <strong id="memory-suggestions-title">Review possible memories</strong>
          <p>Ask Muse Spark to suggest stable, non-sensitive details from one conversation. Nothing is saved unless you approve it.</p>
        </div>
        <div className="memory-suggestion-controls">
          <label className="visually-hidden" htmlFor="memory-source-conversation">Conversation for suggestions</label>
          <select
            id="memory-source-conversation"
            className="setting-select"
            value={sourceConversationId}
            onChange={(event) => {
              setSourceConversationId(event.target.value)
              setCandidates([])
              setSuggestionNotice(undefined)
            }}
            disabled={conversations.length === 0 || isSuggesting}
          >
            <option value="">Choose a conversation</option>
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>{conversation.title}</option>
            ))}
          </select>
          <Button
            className="save-memory-button"
            type="button"
            onClick={() => void requestSuggestions()}
            disabled={!sourceConversationId || !isPreferenceLoaded || !memoryEnabled || isSuggesting}
          >
            <Sparkles size={14} /> {isSuggesting ? "Reviewing…" : "Suggest"}
          </Button>
        </div>
        {!memoryEnabled && <p className="memory-suggestion-note">Memory use is off in Settings. Turn it on before asking for suggestions.</p>}
        {suggestionError && <p className="memory-error" role="alert">{suggestionError}</p>}
        {suggestionNotice && <p className="memory-suggestion-note" role="status">{suggestionNotice}</p>}
        {candidates.length > 0 && (
          <div className="memory-candidate-list">
            {candidates.map((candidate, index) => (
              <article className="memory-candidate" key={`${candidate.category}-${candidate.title}-${index}`}>
                <span className="memory-category">{candidate.category}</span>
                <strong>{candidate.title}</strong>
                <p>{candidate.detail}</p>
                <div>
                  <button type="button" className="text-button" onClick={() => void approveCandidate(candidate)}>Approve & save</button>
                  <button type="button" className="text-button" onClick={() => setCandidates((items) => items.filter((item) => item !== candidate))}>Dismiss</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="memory-toolbar">
        <div className="memory-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memories…" aria-label="Search memories" /></div>
        <span className="memory-count">{visibleMemories.length} {visibleMemories.length === 1 ? "memory" : "memories"}</span>
      </div>
      <div className="category-list" role="group" aria-label="Filter memories by category">
        {categories.map((item) => (
          <button key={item} className={`category-chip ${category === item ? "selected" : ""}`} onClick={() => setCategory(item)} aria-pressed={category === item}>
            {item}
          </button>
        ))}
      </div>
      {error && <p className="memory-error" role="alert">{error}</p>}
      {isLoading ? (
        <div className="memories-loading" role="status"><span className="loading-spinner" /> Loading memories…</div>
      ) : visibleMemories.length ? (
        <div className="memory-grid">
          {visibleMemories.map((memory) => (
            <article className="memory-card" key={memory.id}>
              <div className="memory-card-top">
                <span className="memory-category">{memory.category}</span>
                <div className="memory-actions">
                  <button className="icon-button" onClick={() => setEditing(editing === memory.id ? undefined : memory.id)} aria-label={`Edit ${memory.title}`}><Pencil size={15} /></button>
                  <button className="icon-button delete-action" onClick={() => void remove(memory.id).catch(() => undefined)} aria-label={`Delete ${memory.title}`}><Trash2 size={15} /></button>
                </div>
              </div>
              {editing === memory.id ? (
                <form className="edit-memory-form" onSubmit={(event) => void handleUpdate(event, memory.id)}>
                  <input name="title" defaultValue={memory.title} aria-label="Edit memory title" maxLength={80} required />
                  <textarea name="detail" defaultValue={memory.detail} aria-label="Edit memory detail" maxLength={500} required />
                  <Button size="sm" type="submit"><Check size={14} /> Save changes</Button>
                </form>
              ) : (
                <>
                  <h2>{memory.title}</h2>
                  <p className="memory-detail">{memory.detail}</p>
                  <span className="memory-updated">
                    Updated {new Date(memory.updatedAt).toLocaleDateString()}
                    {memory.sourceConversationId ? " · Suggested from a conversation" : ""}
                  </span>
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="memories-empty">
          <span className="empty-sparkle"><Search size={19} /></span>
          <h2>{memories.length ? "No memories found" : "No saved memories yet"}</h2>
          <p>{memories.length ? "Try another search or choose a different category." : "Add one yourself or review a suggestion from a conversation."}</p>
          {memories.length > 0 && <button className="text-button" onClick={() => { setQuery(""); setCategory("All") }}>Clear filters</button>}
        </div>
      )}
      <p className="memories-disclaimer">Your memory controls apply to this browser session. Add authentication before using this as an account-secure, multi-user memory service.</p>
    </div>
  )
}
