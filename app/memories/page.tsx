"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import Image from "next/image"
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  BrainCircuit,
  ShieldCheck,
  Users,
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
  deleteMainPersonImage,
  getMemoryPreference,
  getMainPersonImage,
  saveMainPersonImage,
  suggestMemories,
} from "@/lib/api/memories"
import { useMemoryStore } from "@/stores/memory-store"
import { useSettingsStore } from "@/stores/settings-store"
import { isMainPersonMemory, personProfileTitle, MEMORY_CATEGORIES, type MemoryCandidate, type MemoryCategory } from "@/types/memory"
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
  const [mainPersonNotice, setMainPersonNotice] = useState<string | undefined>(undefined)
  const [mainPersonError, setMainPersonError] = useState<string | undefined>(undefined)
  const [isEditingMainPerson, setIsEditingMainPerson] = useState(false)
  const [editingMainPersonId, setEditingMainPersonId] = useState<string | undefined>(undefined)
  const [selectedMainPersonImage, setSelectedMainPersonImageFile] = useState<File | undefined>(undefined)
  const [selectedMainPersonImageUrl, setSelectedMainPersonImageUrl] = useState<string | undefined>(undefined)
  const [savedMainPersonImageUrls, setSavedMainPersonImageUrls] = useState<Record<string, string>>({})
  const [mainPersonImageError, setMainPersonImageError] = useState<string | undefined>(undefined)
  const selectedImageUrlRef = useRef<string | undefined>(undefined)

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
  const mainPersonMemories = memories.filter(isMainPersonMemory)
  const mainPersonMemory = mainPersonMemories.find((memory) => memory.id === editingMainPersonId)
  const regularVisibleMemories = visibleMemories.filter((memory) => !isMainPersonMemory(memory))

  const parseMainPersonDetail = (detail: string | undefined) => {
    const fields = { name: "", role: "", notes: "" }
    if (!detail) return fields
    for (const line of detail.split("\n")) {
      const match = line.match(/^(Name|Role|Details):\s*(.*)$/)
      if (!match) continue
      if (match[1] === "Name") fields.name = match[2]
      if (match[1] === "Role") fields.role = match[2]
      if (match[1] === "Details") fields.notes = match[2]
    }
    if (!fields.name && !fields.notes) fields.notes = detail
    return fields
  }
  const mainPersonFields = parseMainPersonDetail(mainPersonMemory?.detail)

  const replaceSavedImagePreview = useCallback((memoryId: string, blob?: Blob) => {
    const url = blob ? URL.createObjectURL(blob) : undefined
    setSavedMainPersonImageUrls((current) => {
      const previousUrl = current[memoryId]
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      const next = { ...current }
      if (url) next[memoryId] = url
      else delete next[memoryId]
      return next
    })
  }, [])

  const updateSelectedImage = (file?: File) => {
    if (selectedImageUrlRef.current) URL.revokeObjectURL(selectedImageUrlRef.current)
    const url = file ? URL.createObjectURL(file) : undefined
    selectedImageUrlRef.current = url
    setSelectedMainPersonImageUrl(url)
    setSelectedMainPersonImageFile(file)
  }

  const profileIdsKey = mainPersonMemories.map(({ id }) => id).join(",")
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const createdUrls: string[] = []
    const profileIds = profileIdsKey ? profileIdsKey.split(",") : []
    void Promise.all(profileIds.map(async (profileId) => {
      try {
        const image = await getMainPersonImage(profileId, controller.signal)
        if (active && image) {
          const url = URL.createObjectURL(image)
          createdUrls.push(url)
          setSavedMainPersonImageUrls((current) => ({ ...current, [profileId]: url }))
        }
      } catch {
        if (active && !controller.signal.aborted) setMainPersonImageError("A saved profile image could not be loaded.")
      }
    }))
    return () => {
      active = false
      controller.abort()
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [profileIdsKey])

  useEffect(() => () => {
    if (selectedImageUrlRef.current) URL.revokeObjectURL(selectedImageUrlRef.current)
  }, [])

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

  const handleSaveMainPerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get("main-person-name") ?? "").trim()
    const role = String(formData.get("main-person-role") ?? "").trim()
    const notes = String(formData.get("main-person-notes") ?? "").trim()
    if (!name) return
    const detail = [`Name: ${name}`, role && `Role: ${role}`, notes && `Details: ${notes}`]
      .filter(Boolean)
      .join("\n")
    if (detail.length > 500) {
      setMainPersonError("Keep the combined profile under 500 characters.")
      return
    }
    setMainPersonError(undefined)
    setMainPersonNotice(undefined)
    setMainPersonImageError(undefined)
    try {
      const title = personProfileTitle(name)
      const savedProfile = mainPersonMemory
        ? (await update(mainPersonMemory.id, { category: "People", title, detail }), mainPersonMemory)
        : await create({ category: "People", title, detail })
      const profileId = savedProfile.id
      if (selectedMainPersonImage) {
        try {
          await saveMainPersonImage(profileId, selectedMainPersonImage)
          const savedImage = await getMainPersonImage(profileId)
          if (savedImage) replaceSavedImagePreview(profileId, savedImage)
          updateSelectedImage(undefined)
          setMainPersonNotice("Profile and image saved. ROCKY can use the profile as conversation context.")
        } catch (error) {
          setMainPersonImageError(error instanceof Error ? error.message : "The profile details were saved, but the image could not be saved.")
          setMainPersonNotice("Profile details were saved. The image still needs to be saved.")
          return
        }
      } else {
        setMainPersonNotice("Saved. ROCKY can use this profile as conversation context.")
      }
      setIsEditingMainPerson(false)
      setEditingMainPersonId(undefined)
    } catch {
      setMainPersonError("The profile could not be saved. Please try again.")
    }
  }

  const handleMainPersonImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    setMainPersonImageError(undefined)
    if (!file) {
      updateSelectedImage(undefined)
      return
    }
    if (!(file.type === "image/jpeg" || file.type === "image/png")) {
      setMainPersonImageError("Choose a JPEG or PNG image.")
      event.currentTarget.value = ""
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setMainPersonImageError("Choose an image smaller than 2 MB.")
      event.currentTarget.value = ""
      return
    }
    updateSelectedImage(file)
  }

  const handleDeleteMainPersonImage = async (memoryId: string) => {
    if (!savedMainPersonImageUrls[memoryId] || !window.confirm("Remove the saved profile image?")) return
    setMainPersonImageError(undefined)
    try {
      await deleteMainPersonImage(memoryId)
      replaceSavedImagePreview(memoryId)
      updateSelectedImage(undefined)
      setMainPersonNotice("The profile image was removed.")
    } catch (error) {
      setMainPersonImageError(error instanceof Error ? error.message : "The profile image could not be removed.")
    }
  }

  const handleDeleteMainPerson = async (memory: typeof memories[number]) => {
    if (!window.confirm(`Delete ${memory.title === "Main person or character" ? "the saved person or character profile" : memory.title.replace(/^Person: /, "")} profile? This cannot be undone.`)) return
    setMainPersonError(undefined)
    setMainPersonNotice(undefined)
    try {
      await remove(memory.id)
      replaceSavedImagePreview(memory.id)
      updateSelectedImage(undefined)
      setMainPersonNotice("The person or character profile was deleted.")
      if (editingMainPersonId === memory.id) {
        setIsEditingMainPerson(false)
        setEditingMainPersonId(undefined)
      }
    } catch {
      setMainPersonError("The profile could not be deleted. Please try again.")
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
    <div className="page memories-page space-y-8">
      <header className="memories-hero mb-0 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <Badge variant="outline" className="memory-eyebrow mb-3">YOUR PERSONAL CONTEXT</Badge>
          <h1 className="m-0 text-4xl font-medium tracking-tight sm:text-5xl">
            Memories<span className="heading-period">.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
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

      <Card className="memory-privacy flex-row items-center gap-4 border-accent/30 bg-accent/5 p-4 shadow-none">
        <div className="memory-privacy-icon mt-0.5 rounded-xl bg-accent/15 p-2.5 text-accent-foreground">
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

      <Card className="memory-feature-card">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">People</Badge>
            <CardTitle className="text-xl">People and characters</CardTitle>
            <CardDescription className="max-w-2xl">
              Save yourself, people, or fictional characters ROCKY should remember in conversation. Profiles help with names and context; ROCKY will not use them to identify anyone from camera images. Keep details non-sensitive and only save information you approve.
            </CardDescription>
          </div>
          <Button type="button" className="shrink-0" disabled={!isPreferenceLoaded || !memoryEnabled} onClick={() => {
            setEditingMainPersonId(undefined)
            setIsEditingMainPerson(true)
            setMainPersonNotice(undefined)
            setMainPersonError(undefined)
            setMainPersonImageError(undefined)
            updateSelectedImage(undefined)
          }}><Plus size={15} /> Add a person</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {mainPersonMemories.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {mainPersonMemories.map((profile) => {
                const fields = parseMainPersonDetail(profile.detail)
                const imageUrl = savedMainPersonImageUrls[profile.id]
                return <Card key={profile.id} className="memory-person-card bg-muted/20 shadow-none">
                  <CardContent className="space-y-4 p-4">
                    <div className="memory-profile-summary">
                      {imageUrl ? <Image src={imageUrl} alt={`Saved profile image for ${fields.name || "person or character"}`} width={96} height={96} unoptimized className="memory-profile-image size-24 rounded-2xl border object-cover" /> : <div className="memory-profile-placeholder" aria-hidden="true"><Users size={23} /></div>}
                      <div className="min-w-0 space-y-1">
                        <p className="break-words text-lg font-semibold tracking-tight">{fields.name || profile.title.replace(/^Person: /, "") || "Saved person or character"}</p>
                        {fields.role && <p className="text-sm text-muted-foreground">{fields.role}</p>}
                        {fields.notes && <p className="line-clamp-3 text-sm leading-relaxed text-foreground/80">{fields.notes}</p>}
                        <p className="pt-1 text-xs text-muted-foreground">Updated {new Date(profile.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setEditingMainPersonId(profile.id)
                        setIsEditingMainPerson(true)
                        setMainPersonNotice(undefined)
                        setMainPersonError(undefined)
                        setMainPersonImageError(undefined)
                        updateSelectedImage(undefined)
                      }}><Pencil size={14} /> Edit</Button>
                      {imageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => void handleDeleteMainPersonImage(profile.id)}><Trash2 size={14} /> Remove image</Button>}
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void handleDeleteMainPerson(profile)}><Trash2 size={14} /> Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              })}
            </div>
          ) : !isEditingMainPerson ? (
            <div className="memory-people-empty rounded-xl border border-dashed p-6 text-center">
              <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-accent/10 text-accent-foreground"><Users size={19} /></div>
              <p className="text-sm font-medium">No people saved yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a profile to help ROCKY remember names and context.</p>
            </div>
          ) : null}
          {isEditingMainPerson && (
            <form key={editingMainPersonId ?? "new-person-profile"} className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5" onSubmit={(event) => void handleSaveMainPerson(event)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Name
                  <Input className="h-10 font-normal" name="main-person-name" defaultValue={mainPersonFields.name} placeholder="Name or character name" maxLength={72} required disabled={!isPreferenceLoaded || !memoryEnabled} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Who are they to you?
                  <Input className="h-10 font-normal" name="main-person-role" defaultValue={mainPersonFields.role} placeholder="For example, me, a friend, or a character" maxLength={100} disabled={!isPreferenceLoaded || !memoryEnabled} />
                </label>
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  What should ROCKY keep in mind?
                  <Textarea className="min-h-20 resize-y font-normal" name="main-person-notes" defaultValue={mainPersonFields.notes} placeholder="A few useful details you approve saving" maxLength={300} disabled={!isPreferenceLoaded || !memoryEnabled} />
                </label>
                <div className="grid gap-2 text-sm font-medium sm:col-span-2">
                  <label htmlFor="main-person-image">Profile image (optional)</label>
                  <Input id="main-person-image" className="h-auto min-h-10 font-normal" type="file" accept="image/jpeg,image/png" onChange={handleMainPersonImageSelection} disabled={!isPreferenceLoaded || !memoryEnabled} />
                  <p className="text-xs font-normal text-muted-foreground">JPEG or PNG, up to 2 MB. The photo is stored with this memory for you to review; it is not matched against camera images.</p>
                  {(selectedMainPersonImageUrl || (mainPersonMemory && savedMainPersonImageUrls[mainPersonMemory.id])) && <Image src={selectedMainPersonImageUrl || savedMainPersonImageUrls[mainPersonMemory!.id]} alt="Preview of the person or character profile image" width={128} height={128} unoptimized className="size-32 rounded-xl border object-cover" />}
                  {mainPersonMemory && savedMainPersonImageUrls[mainPersonMemory.id] && !selectedMainPersonImage && <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => void handleDeleteMainPersonImage(mainPersonMemory.id)}><Trash2 size={14} /> Remove saved image</Button>}
                  {mainPersonImageError && <p className="text-sm font-normal text-destructive" role="alert">{mainPersonImageError}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  {!mainPersonMemory && <Checkbox name="main-person-approval" required disabled={!isPreferenceLoaded || !memoryEnabled} />}
                  <span>{mainPersonMemory ? "I approve these profile updates. I can edit or delete this profile later." : "I approve saving this person or character profile as a memory. I can edit or delete it later."}</span>
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setIsEditingMainPerson(false); setEditingMainPersonId(undefined); updateSelectedImage(undefined); setMainPersonImageError(undefined) }}>Cancel</Button>
                  <Button className="w-full sm:w-auto" type="submit" disabled={!isPreferenceLoaded || !memoryEnabled}><Check size={15} /> {mainPersonMemory ? "Save changes" : "Approve & save"}</Button>
                </div>
              </div>
            </form>
          )}
          {mainPersonError && <p className="text-sm text-destructive" role="alert">{mainPersonError}</p>}
          {mainPersonImageError && !isEditingMainPerson && <p className="text-sm text-destructive" role="alert">{mainPersonImageError}</p>}
          {mainPersonNotice && <p className="text-sm text-muted-foreground" role="status">{mainPersonNotice}</p>}
        </CardContent>
      </Card>

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

      <Card role="region" aria-labelledby="memory-suggestions-title" className="memory-feature-card">
        <CardHeader className="gap-3">
          <CardTitle id="memory-suggestions-title" className="text-xl">Review possible memories</CardTitle>
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
        <div className="memory-list-heading flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
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
          <div className="memory-filter-list flex flex-wrap gap-2" role="group" aria-label="Filter memories by category">
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
      ) : regularVisibleMemories.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {regularVisibleMemories.map((memory) => (
            <Card key={memory.id} className="memory-item-card transition-shadow hover:shadow-md">
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
            <CardTitle>{memories.length ? "No other memories found" : "A little context goes a long way"}</CardTitle>
            <CardDescription>
              {memories.length ? "Try another search or choose a different category. Your main person or character profile is managed above." : "Save a preference, goal, or ongoing detail. Nothing is stored without your approval."}
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
