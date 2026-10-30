"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Clock3, LoaderCircle, ScanEye, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { GoogleIcon } from "@/components/ui/google-icon"
import { Card } from "@/components/ui/card"
import {
  deleteVisualAnalysisHistoryItem,
  listVisualAnalysisHistory,
  type VisualAnalysisHistoryItem,
} from "@/lib/visual-analysis-history"
import { AuthStore } from "@/stores/auth-store"

function HistoryCard({ item, onDelete }: {
  item: VisualAnalysisHistoryItem
  onDelete: (id: string) => void
}) {
  const [imageUrl, setImageUrl] = useState("")

  useEffect(() => {
    const url = URL.createObjectURL(item.image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [item.image])

  return (
    <Card className="analysis-history-card gap-0 overflow-hidden border border-border p-0 ring-0">
      <div className="analysis-history-image relative aspect-[4/3] overflow-hidden bg-muted">
        {imageUrl && <Image src={imageUrl} alt={`Saved image: ${item.imageName}`} fill unoptimized className="object-cover" />}
      </div>
      <div className="grid gap-3 p-4">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-sm font-semibold">{item.analysis.result.title}</h2>
          <p className="mb-0 mt-1 text-xs text-muted-foreground">{item.analysis.result.category} · {new Date(item.createdAt).toLocaleString()}</p>
          <p className="mb-0 mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.analysis.result.shortDescription}</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Link className={buttonVariants({ size: "sm" })} href={`/visual-intelligence?historyId=${encodeURIComponent(item.id)}`}><ScanEye aria-hidden="true" />Use this image again</Link>
          <Button type="button" size="icon" variant="outline" aria-label={`Delete ${item.analysis.result.title} from history`} onClick={() => onDelete(item.id)}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function AnalysisHistory() {
  const { auth, isLoading, signinWithGoogle } = AuthStore()
  const [items, setItems] = useState<VisualAnalysisHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (isLoading) return
    if (!auth) {
      setItems([])
      setLoadingHistory(false)
      return
    }
    let canceled = false
    setLoadingHistory(true)
    setError("")
    void listVisualAnalysisHistory(auth.id).then((records) => {
      if (!canceled) setItems(records)
    }).catch(() => {
      if (!canceled) setError("Rocky could not load analysis history from this browser.")
    }).finally(() => {
      if (!canceled) setLoadingHistory(false)
    })
    return () => { canceled = true }
  }, [auth, isLoading])

  const removeItem = async (id: string) => {
    if (!auth) return
    try {
      await deleteVisualAnalysisHistoryItem(auth.id, id)
      setItems((current) => current.filter((item) => item.id !== id))
    } catch {
      setError("Rocky could not delete that saved analysis. Try again.")
    }
  }

  return (
    <div className="page analysis-history-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>Recent analyses<span className="heading-period">.</span></h1>
          <p>Saved analyses are available only in this browser and only while you’re signed in.</p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/"><ArrowLeft aria-hidden="true" />Back to analyzer</Link>
      </div>

      {isLoading || loadingHistory ? (
        <Card className="flex min-h-40 items-center justify-center gap-2 border border-border p-5 text-sm text-muted-foreground ring-0" role="status">
          <LoaderCircle className="animate-spin" aria-hidden="true" /> Loading history…
        </Card>
      ) : !auth ? (
        <Card className="grid justify-items-center gap-3 border border-border p-6 text-center ring-0 sm:p-10">
          <Clock3 className="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="m-0 text-base font-semibold">Sign in to keep an analysis history</h2>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">Rocky doesn’t save analyses while you’re signed out.</p>
          </div>
          <Button type="button" onClick={() => void signinWithGoogle()}><GoogleIcon />Continue with Google</Button>
        </Card>
      ) : error ? (
        <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <Card className="grid justify-items-center gap-3 border border-border p-6 text-center ring-0 sm:p-10">
          <Clock3 className="size-8 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="m-0 text-base font-semibold">No saved analyses yet</h2>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">Sign in before analyzing an image and it will appear here.</p>
          </div>
          <Link className={buttonVariants({ variant: "outline" })} href="/"><ScanEye aria-hidden="true" />Analyze an image</Link>
        </Card>
      ) : (
        <>
          {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <div className="analysis-history-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => <HistoryCard key={item.id} item={item} onDelete={(id) => void removeItem(id)} />)}
          </div>
        </>
      )}
    </div>
  )
}
