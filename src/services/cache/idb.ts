const DB_NAME = 'ytbt-cache'
const DB_VERSION = 1

export type StoreName = 'media' | 'transcribe' | 'translate' | 'meta'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('media')) {
        db.createObjectStore('media', { keyPath: 'fileKey' })
      }
      if (!db.objectStoreNames.contains('transcribe')) {
        const s = db.createObjectStore('transcribe', { keyPath: 'transcribeKey' })
        s.createIndex('fileKey', 'fileKey', { unique: false })
      }
      if (!db.objectStoreNames.contains('translate')) {
        const s = db.createObjectStore('translate', { keyPath: 'translateKey' })
        s.createIndex('transcribeKey', 'transcribeKey', { unique: false })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }
  })
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPut<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(store).put(value)
  })
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(store).delete(key)
  })
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve((req.result as T[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAllByIndex<T>(
  store: 'transcribe' | 'translate',
  indexName: string,
  query: string,
): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const idx = tx.objectStore(store).index(indexName)
    const req = idx.getAll(query)
    req.onsuccess = () => resolve((req.result as T[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}
