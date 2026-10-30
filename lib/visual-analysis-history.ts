import type { VisualAnalysisResponse } from "@/lib/visual-intelligence-client"

const DATABASE_NAME = "rocky-visual-history"
const DATABASE_VERSION = 1
const STORE_NAME = "analyses"
const MAX_HISTORY_ITEMS = 30

export interface VisualAnalysisHistoryItem {
  id: string
  userId: string
  createdAt: string
  imageName: string
  image: Blob
  question: string
  analysis: VisualAnalysisResponse
}

function openHistoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Analysis history is not available in this browser."))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (database.objectStoreNames.contains(STORE_NAME)) return
      const store = database.createObjectStore(STORE_NAME, { keyPath: "id" })
      store.createIndex("userId", "userId", { unique: false })
      store.createIndex("createdAt", "createdAt", { unique: false })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open analysis history."))
    request.onblocked = () => reject(new Error("Analysis history is busy in another tab. Close other Rocky tabs and try again."))
  })
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not update analysis history."))
    transaction.onabort = () => reject(transaction.error ?? new Error("Analysis history update was canceled."))
  })
}

export async function saveVisualAnalysisHistory(item: VisualAnalysisHistoryItem): Promise<void> {
  if (!item.userId) return
  const database = await openHistoryDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    store.put(item)
    const request = store.index("userId").getAll(item.userId)
    request.onsuccess = () => {
      const records = (request.result as VisualAnalysisHistoryItem[]).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      for (const oldRecord of records.slice(MAX_HISTORY_ITEMS)) store.delete(oldRecord.id)
    }
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function listVisualAnalysisHistory(userId: string): Promise<VisualAnalysisHistoryItem[]> {
  if (!userId) return []
  const database = await openHistoryDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const request = transaction.objectStore(STORE_NAME).index("userId").getAll(userId)
    const records = await new Promise<VisualAnalysisHistoryItem[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as VisualAnalysisHistoryItem[])
      request.onerror = () => reject(request.error ?? new Error("Could not read analysis history."))
    })
    return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  } finally {
    database.close()
  }
}

export async function getVisualAnalysisHistoryItem(userId: string, id: string): Promise<VisualAnalysisHistoryItem | null> {
  if (!userId || !id) return null
  const database = await openHistoryDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const request = transaction.objectStore(STORE_NAME).get(id)
    const record = await new Promise<VisualAnalysisHistoryItem | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as VisualAnalysisHistoryItem | undefined)
      request.onerror = () => reject(request.error ?? new Error("Could not read this saved analysis."))
    })
    return record?.userId === userId ? record : null
  } finally {
    database.close()
  }
}

export async function deleteVisualAnalysisHistoryItem(userId: string, id: string): Promise<void> {
  if (!userId || !id) return
  const database = await openHistoryDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => {
      const record = request.result as VisualAnalysisHistoryItem | undefined
      if (record?.userId === userId) store.delete(id)
    }
    await waitForTransaction(transaction)
  } finally {
    database.close()
  }
}
