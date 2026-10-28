"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  BrainCircuit,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
    <div className="page memories-page space-y-6">
      <header className="mb-0 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="mb-3">YOUR PERSONAL CONTEXT</Badge>
          <h1 className="m-0 text-4xl font-medium tracking-tight sm:text-5xl">
            Memories<span className="heading-period">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review and manage the details you choose to let Rocky remember.
          </p>
        </div>
        <Button
          size="lg"
          variant={showNew ? "outline" : "default"}
          disabled={!isPreferenceLoaded || !memoryEnabled}
          aria-expanded={showNew}
          aria-controls={showNew ? "add-memory-form" : undefined}
          className="w-full sm:w-auto"
          onClick={() => setShowNew((value) => !value)}
        >
          {showNew ? <X size={16} /> : <Plus size={16} />}
          {showNew ? "Cancel" : "Add a memory"}
        </Button>
      </header>

      <Card className="flex-row items-center gap-4 border-accent/30 bg-accent/5 p-4 shadow-none">
        <div className="mt-0.5 rounded-lg bg-accent/15 p-2 text-accent-foreground">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">Only saved with your approval</p>
          <CardDescription className="leading-relaxed">
            Memories are stored in Neon for this browser. Approved, relevant memories may be
            included in a Muse Spark request. Rocky does not save chat messages as memories
            automatically.
          </CardDescription>
        </div>
        <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">User controlled</Badge>
      </Card>

      {preferenceError && (
        <Card role="alert" className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-none">
          {preferenceError}
        </Card>
      )}
      {!memoryEnabled && <Card role="status" className="border-accent/30 bg-accent/5 p-4 text-sm text-muted-foreground shadow-none">Memory is off. Turn it on in Settings before adding or suggesting memories. You can still review, edit, and delete saved memories.</Card>}

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>Add a memory</CardTitle>
            <CardDescription>Saving means you approve Rocky storing and using this detail.</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="add-memory-form" className="grid gap-5" onSubmit={(event) => void handleCreate(event)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Memory title
                  <Input className="h-10 font-normal" name="title" placeholder="A short, clear title" required maxLength={80} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Category
                  <Select name="category" defaultValue="Preferences">
                    <SelectTrigger aria-label="Memory category" className="h-10 w-full font-normal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  What should Rocky remember?
                  <Textarea className="min-h-24 resize-y font-normal" name="detail" placeholder="Add a useful detail you want Rocky to keep in mind…" required maxLength={500} />
                </label>
              </div>
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Checkbox name="approval" required />
                  <span>I approve storing this information as a memory. I can edit or delete it later.</span>
                </label>
                <Button className="w-full sm:w-auto" type="submit"><Check size={15} /> Approve & save</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card role="region" aria-labelledby="memory-suggestions-title">
        <CardHeader>
          <CardTitle id="memory-suggestions-title">Review possible memories</CardTitle>
          <CardDescription>
            Ask Muse Spark to suggest stable, non-sensitive details from one conversation. Nothing is saved unless you approve it.
          </CardDescription>
          <CardAction><Badge variant="outline"><BrainCircuit /> Muse Spark</Badge></CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="visually-hidden" htmlFor="memory-source-conversation">Conversation for suggestions</label>
          <Select
            value={sourceConversationId || null}
            onValueChange={(value) => {
              setSourceConversationId(value ?? "")
              setCandidates([])
              setSuggestionNotice(undefined)
            }}
            disabled={conversations.length === 0 || isSuggesting}
          >
            <SelectTrigger id="memory-source-conversation" aria-label="Conversation for memory suggestions" className="w-full flex-1">
              <SelectValue>
                {conversations.find((conversation) => conversation.id === sourceConversationId)?.title ?? "Choose a conversation"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {conversations.map((conversation) => (
                <SelectItem key={conversation.id} value={conversation.id}>{conversation.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => void requestSuggestions()}
            disabled={!sourceConversationId || !isPreferenceLoaded || !memoryEnabled || isSuggesting}
          >
            <BrainCircuit size={14} /> {isSuggesting ? "Reviewing…" : "Suggest memories"}
          </Button>
        </div>
        {!memoryEnabled && <p className="text-sm text-muted-foreground">Memory use is off in Settings. Turn it on before asking for suggestions.</p>}
        {suggestionError && <Card role="alert" className="border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive shadow-none">{suggestionError}</Card>}
        {suggestionNotice && <p className="text-sm text-muted-foreground" role="status">{suggestionNotice}</p>}
        {candidates.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {candidates.map((candidate, index) => (
              <Card className="bg-muted/30 shadow-none" key={`${candidate.category}-${candidate.title}-${index}`}>
                <CardHeader className="pb-2">
                  <Badge variant="secondary" className="w-fit">{candidate.category}</Badge>
                  <CardTitle className="pt-2">{candidate.title}</CardTitle>
                  <CardDescription>{candidate.detail}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void approveCandidate(candidate)}>Approve & save</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCandidates((items) => items.filter((item) => item !== candidate))}>Dismiss</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      <section className="space-y-4" aria-labelledby="saved-memories-title">
        <div className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 id="saved-memories-title" className="text-xl font-medium tracking-tight">Your saved memories</h2>
            <p className="text-sm text-muted-foreground">A small collection of details you’ve chosen to keep.</p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {visibleMemories.length} {visibleMemories.length === 1 ? "memory" : "memories"}
          </Badge>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or detail…" aria-label="Search memories" />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter memories by category">
            {categories.map((item) => (
              <Button type="button" variant={category === item ? "secondary" : "outline"} size="sm" key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>
                {item}
              </Button>
            ))}
          </div>
        </div>
      </section>
      {error && <Card role="alert" className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-none">{error}</Card>}
      {isLoading ? (
        <Card className="flex min-h-36 items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="loading-spinner" /> Loading memories…
        </Card>
      ) : visibleMemories.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleMemories.map((memory) => (
            <Card key={memory.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="grid-cols-[1fr_auto]">
                <Badge variant="secondary" className="w-fit">{memory.category}</Badge>
                <CardAction className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(editing === memory.id ? undefined : memory.id)} aria-label={`Edit ${memory.title}`}><Pencil size={15} /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => {
                    if (window.confirm(`Delete “${memory.title}”? This cannot be undone.`)) void remove(memory.id).catch(() => undefined)
                  }} aria-label={`Delete ${memory.title}`}><Trash2 size={15} /></Button>
                </CardAction>
                {editing === memory.id ? null : (
                  <div className="col-span-2 space-y-2">
                    <CardTitle>{memory.title}</CardTitle>
                    <CardDescription className="leading-relaxed text-foreground/80">{memory.detail}</CardDescription>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {editing === memory.id ? (
                  <form className="grid gap-3" onSubmit={(event) => void handleUpdate(event, memory.id)}>
                    <Input name="title" defaultValue={memory.title} aria-label="Edit memory title" maxLength={80} required />
                    <Textarea name="detail" defaultValue={memory.detail} aria-label="Edit memory detail" maxLength={500} required />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setEditing(undefined)}>Cancel</Button>
                      <Button size="sm" type="submit"><Check size={14} /> Save changes</Button>
                    </div>
                  </form>
                ) : (
                  <div className="border-t pt-3 text-xs text-muted-foreground">
                    Updated {new Date(memory.updatedAt).toLocaleDateString()}
                    {memory.sourceConversationId ? " · Suggested from a conversation" : ""}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="items-center border-dashed py-12 text-center shadow-none">
          <CardContent className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted p-3 text-muted-foreground"><Search size={20} /></div>
            <CardTitle>{memories.length ? "No memories found" : "A little context goes a long way"}</CardTitle>
            <CardDescription>
              {memories.length ? "Try another search or choose a different category." : "Save a preference, goal, or ongoing detail. Nothing is stored without your approval."}
            </CardDescription>
            {memories.length > 0 && <Button variant="outline" size="sm" onClick={() => { setQuery(""); setCategory("All") }}>Clear filters</Button>}
            {!memories.length && !showNew && <Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Add your first memory</Button>}
          </CardContent>
        </Card>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Your memory controls apply to this browser session. Add authentication before using this as an account-secure, multi-user memory service.
      </p>
    </div>
  )
}
