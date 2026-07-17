const DB_NAME = 'acme-dataroom-files'
const DB_VERSION = 1
const STORE_NAME = 'pdfs'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

async function runStoreTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb()

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = operation(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function savePdfBlob(blobId: string, blob: Blob) {
  await runStoreTransaction('readwrite', (store) => store.put(blob, blobId))
}

export async function getPdfBlob(blobId: string) {
  return runStoreTransaction<Blob | undefined>('readonly', (store) => store.get(blobId))
}

export async function deletePdfBlobs(blobIds: string[]) {
  if (blobIds.length === 0) return

  const db = await openDb()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    for (const blobId of blobIds) {
      store.delete(blobId)
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
