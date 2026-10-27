"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Search, Plus, Trash2, Pencil, LockKeyhole, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMemoryStore } from "@/stores/memory-store"
import type { MemoryCategory } from "@/types/memory"

const categories: Array<MemoryCategory | "All"> = [
  "All",
  "Preferences",
  "Goals",
  "People",
  "Ongoing tasks",
]

export default function MemoriesPage() {
  const memories = useMemoryStore((store) => store.memories)
  const query = useMemoryStore((store) => store.query)
  const category = useMemoryStore((store) => store.category)
  const isLoading = useMemoryStore((store) => store.isLoading)
  const error = useMemoryStore((store) => store.error)
  const setQuery = useMemoryStore((store) => store.setQuery)
  const setCategory = useMemoryStore((store) => store.setCategory)
  const create = useMemoryStore((store) => store.create)
  const update = useMemoryStore((store) => store.update)
  const remove = useMemoryStore((store) => store.remove)
  const [editing, setEditing] = useState<string>()
  const [showNew, setShowNew] = useState(false)

  const visibleMemories = useMemo(() => memories.filter((memory) => {
    const matchesCategory = category === "All" || memory.category === category
    const searchText = `${memory.title} ${memory.detail} ${memory.category}`.toLowerCase()
    return matchesCategory && searchText.includes(query.toLowerCase())
  }), [category, memories, query])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const title = String(formData.get("title") ?? "").trim()
    const detail = String(formData.get("detail") ?? "").trim()
    const selectedCategory = String(formData.get("category") ?? "Preferences") as MemoryCategory
    if (!title || !detail) return
    create({ title, detail, category: selectedCategory })
    setShowNew(false)
  }

  return (
    <div className="page memories-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">YOUR PERSONAL CONTEXT</span>
          <h1>Memories<span className="heading-period">.</span></h1>
          <p>A thoughtful place for the little things you choose to share.</p>
        </div>
        <Button className="primary-action" onClick={() => setShowNew((value) => !value)}>
          {showNew ? <X size={16} /> : <Plus size={16} />}
          {showNew ? "Cancel" : "Add a memory"}
        </Button>
      </header>

      <div className="memory-privacy">
        <span className="privacy-lock"><LockKeyhole size={16} /></span>
        <div><strong>Only saved with your permission</strong><p>These are sample memories for this demo. Nothing is stored on a server or shared across sessions.</p></div>
        <span className="sample-label">LOCAL DEMO</span>
      </div>

      {showNew && (
        <form className="new-memory-form" onSubmit={handleCreate}>
          <div className="form-topline"><strong>Add a memory</strong><span>Saved locally for this demo only</span></div>
          <div className="memory-form-grid">
            <input name="title" placeholder="A short title" aria-label="Memory title" required maxLength={80} />
            <select name="category" aria-label="Memory category" defaultValue="Preferences">
              {categories.filter((item): item is MemoryCategory => item !== "All").map((item) => <option key={item}>{item}</option>)}
            </select>
            <input name="detail" placeholder="What would you like to remember?" aria-label="Memory detail" required maxLength={300} />
            <Button className="save-memory-button" type="submit"><Check size={15} /> Save</Button>
          </div>
        </form>
      )}

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
                  <button className="icon-button delete-action" onClick={() => remove(memory.id)} aria-label={`Delete ${memory.title}`}><Trash2 size={15} /></button>
                </div>
              </div>
              {editing === memory.id ? (
                <form className="edit-memory-form" onSubmit={(event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  update(memory.id, String(data.get("title") ?? ""), String(data.get("detail") ?? ""))
                  setEditing(undefined)
                }}>
                  <input name="title" defaultValue={memory.title} aria-label="Edit memory title" maxLength={80} required />
                  <textarea name="detail" defaultValue={memory.detail} aria-label="Edit memory detail" maxLength={300} required />
                  <Button size="sm" type="submit"><Check size={14} /> Done</Button>
                </form>
              ) : (
                <>
                  <h2>{memory.title}</h2>
                  <p className="memory-detail">{memory.detail}</p>
                  <span className="memory-updated">{memory.updatedAt}</span>
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="memories-empty">
          <span className="empty-sparkle"><Search size={19} /></span>
          <h2>No memories found</h2>
          <p>Try another search or choose a different category.</p>
          <button className="text-button" onClick={() => { setQuery(""); setCategory("All") }}>Clear filters</button>
        </div>
      )}
      <p className="memories-disclaimer">Demo content only · memory controls update this page locally and do not save to a backend.</p>
    </div>
  )
}
