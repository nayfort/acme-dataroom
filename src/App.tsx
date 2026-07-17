import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ContentPane } from './components/ContentPane'
import { FilePreview } from './components/FilePreview'
import { NameDialog } from './components/NameDialog'
import { Sidebar } from './components/Sidebar'
import { ToastStack, type ToastMessage } from './components/Toast'
import { Toolbar } from './components/Toolbar'
import {
  addFiles,
  addFolder,
  canReceiveChildren,
  createDataroom,
  createInitialState,
  deleteItemTree,
  getActiveDataroom,
  getChildren,
  getDescendantItems,
  getFolderPath,
  getItemCountsByRoom,
  getItem,
  getItemLocation,
  loadMetadata,
  renameItem,
  saveMetadata,
  searchItems,
  selectDataroom,
  selectFolder,
  validatePdfFile,
} from './lib/dataroom-model'
import { pluralize } from './lib/format'
import { makeId } from './lib/id'
import { deletePdfBlobs, savePdfBlob } from './lib/pdf-store'
import type { DataroomItem, FileItem } from './types'

type DialogState =
  | { type: 'create-dataroom' }
  | { type: 'create-folder' }
  | { type: 'rename-item'; item: DataroomItem }
  | { type: 'delete-item'; item: DataroomItem }
  | null

function App() {
  const [state, setState] = useState(() => loadMetadata() ?? createInitialState())
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [isUploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeDataroom = getActiveDataroom(state)
  const activeFolderId = state.activeFolderId
  const breadcrumbs = useMemo(() => getFolderPath(state, activeFolderId), [state, activeFolderId])
  const visibleItems = useMemo(() => {
    if (!activeDataroom) return []
    if (query.trim()) return searchItems(state, activeDataroom.id, query)
    return getChildren(state, activeDataroom.id, activeFolderId)
  }, [activeDataroom, activeFolderId, query, state])
  const itemCounts = useMemo(() => getItemCountsByRoom(state), [state])
  const previewFile = previewFileId ? getItem(state, previewFileId) : null

  useEffect(() => {
    saveMetadata(state)
  }, [state])

  function showToast(message: string, tone: ToastMessage['tone'] = 'info') {
    const toast: ToastMessage = { id: makeId('toast'), message, tone }
    setToasts((current) => [...current, toast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id))
    }, 4200)
  }

  function summarizeFileNames(names: string[]) {
    const visibleNames = names.slice(0, 3).join(', ')
    if (names.length <= 3) return visibleNames

    return `${visibleNames}, +${names.length - 3} more`
  }

  function createRoom(name: string) {
    const result = createDataroom(state, name)
    setState(result.state)
    setQuery('')
    setPreviewFileId(null)
    showToast(`Created dataroom "${result.room.name}".`, 'success')
  }

  function createFolder(name: string) {
    const result = addFolder(state, activeDataroom.id, activeFolderId, name)
    setState(result.state)
    showToast(`Created folder "${result.item.name}".`, 'success')
  }

  function renameExistingItem(item: DataroomItem, name: string) {
    const result = renameItem(state, item.id, name)
    if (result.error) return result.error

    setState(result.state)
    showToast(`Renamed to "${result.item?.name}".`, 'success')
  }

  async function confirmDeleteItem(item: DataroomItem) {
    const result = deleteItemTree(state, item.id)
    setState(result.state)
    setDialog(null)

    if (previewFileId && result.deletedItems.some((deletedItem) => deletedItem.id === previewFileId)) {
      setPreviewFileId(null)
    }

    try {
      await deletePdfBlobs(result.deletedFileBlobIds)
      showToast(`Deleted "${item.name}".`, 'success')
    } catch {
      showToast('Metadata was deleted, but stored PDF cleanup failed.', 'error')
    }
  }

  async function handleUploadFiles(fileList: FileList) {
    if (isUploading) {
      showToast('Another upload is already in progress.', 'info')
      return
    }

    const incomingFiles = Array.from(fileList)
    const targetDataroomId = activeDataroom.id
    const targetFolderId = activeFolderId

    if (!canReceiveChildren(state, targetDataroomId, targetFolderId)) {
      showToast('This upload destination no longer exists.', 'error')
      return
    }

    setUploading(true)

    try {
      const inspectedFiles = await Promise.all(
        incomingFiles.map(async (file) => ({
          file,
          error: await validatePdfFile(file),
        })),
      )
      const acceptedFiles = inspectedFiles
        .filter((entry) => entry.error === null)
        .map((entry) => entry.file)
      const rejectedFiles = inspectedFiles.filter((entry) => entry.error !== null)

      if (acceptedFiles.length === 0) {
        showToast(rejectedFiles[0]?.error ?? 'Only PDF files are supported.', 'error')
        return
      }

      const uploads = await Promise.all(
        acceptedFiles.map(async (file) => {
          const blobId = makeId('blob')
          await savePdfBlob(blobId, file)
          return {
            blobId,
            name: file.name,
            originalName: file.name,
            size: file.size,
          }
        }),
      )

      const result = addFiles(state, targetDataroomId, targetFolderId, uploads)
      setState(result.state)
      showToast(`${pluralize(result.items.length, 'PDF', 'PDFs')} uploaded.`, 'success')

      if (rejectedFiles.length > 0) {
        showToast(
          `${pluralize(rejectedFiles.length, 'file was', 'files were')} skipped: ${summarizeFileNames(
            rejectedFiles.map((entry) => entry.file.name),
          )}.`,
          'error',
        )
      }
    } catch {
      showToast('Upload failed. The browser could not store the PDF.', 'error')
    } finally {
      setUploading(false)
    }
  }

  function openUploadPicker() {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  function deleteDialogMessage(item: DataroomItem) {
    if (item.kind === 'file') {
      return `Delete "${item.name}" from this dataroom?`
    }

    const nestedCount = getDescendantItems(state, item.id).length - 1
    if (nestedCount === 0) {
      return `Delete folder "${item.name}"?`
    }

    return `Delete folder "${item.name}" and ${pluralize(nestedCount, 'nested item', 'nested items')}?`
  }

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        accept="application/pdf,.pdf"
        disabled={isUploading}
        hidden
        multiple
        type="file"
        onChange={(event) => {
          if (event.currentTarget.files) {
            void handleUploadFiles(event.currentTarget.files)
          }
          event.currentTarget.value = ''
        }}
      />

      <Sidebar
        activeDataroomId={state.activeDataroomId}
        datarooms={state.datarooms}
        itemCounts={itemCounts}
        onCreate={() => setDialog({ type: 'create-dataroom' })}
        onSelect={(dataroomId) => {
          setState(selectDataroom(state, dataroomId))
          setQuery('')
          setPreviewFileId(null)
        }}
      />

      <section className="workspace">
        <Toolbar
          breadcrumbs={breadcrumbs}
          dataroom={activeDataroom}
          query={query}
          onNavigateFolder={(folderId) => {
            setState(selectFolder(state, folderId))
            setQuery('')
          }}
          onNavigateRoot={() => {
            setState(selectFolder(state, null))
            setQuery('')
          }}
          onNewFolder={() => setDialog({ type: 'create-folder' })}
          onQueryChange={setQuery}
          onUploadClick={openUploadPicker}
          isUploading={isUploading}
        />

        <ContentPane
          isSearching={Boolean(query.trim())}
          isUploading={isUploading}
          items={visibleItems}
          locationForItem={(item) => getItemLocation(state, item).join(' / ')}
          query={query}
          onDelete={(item) => setDialog({ type: 'delete-item', item })}
          onDropFiles={(files) => void handleUploadFiles(files)}
          onOpenFolder={(folderId) => {
            setState(selectFolder(state, folderId))
            setQuery('')
          }}
          onPreviewFile={setPreviewFileId}
          onRename={(item) => setDialog({ type: 'rename-item', item })}
          onUploadClick={openUploadPicker}
        />
      </section>

      {previewFile?.kind === 'file' ? (
        <FilePreview
          file={previewFile as FileItem}
          onClose={() => setPreviewFileId(null)}
          onDelete={(item) => setDialog({ type: 'delete-item', item })}
          onRename={(item) => setDialog({ type: 'rename-item', item })}
        />
      ) : null}

      {dialog?.type === 'create-dataroom' ? (
        <NameDialog
          confirmLabel="Create"
          label="Dataroom name"
          title="Create dataroom"
          onClose={() => setDialog(null)}
          onSubmit={(name) => createRoom(name)}
        />
      ) : null}

      {dialog?.type === 'create-folder' ? (
        <NameDialog
          confirmLabel="Create"
          label="Folder name"
          title="Create folder"
          onClose={() => setDialog(null)}
          onSubmit={(name) => createFolder(name)}
        />
      ) : null}

      {dialog?.type === 'rename-item' ? (
        <NameDialog
          confirmLabel="Save"
          initialValue={dialog.item.name}
          label={dialog.item.kind === 'file' ? 'File name' : 'Folder name'}
          title={`Rename ${dialog.item.kind}`}
          onClose={() => setDialog(null)}
          onSubmit={(name) => renameExistingItem(dialog.item, name)}
        />
      ) : null}

      {dialog?.type === 'delete-item' ? (
        <ConfirmDialog
          confirmLabel="Delete"
          message={deleteDialogMessage(dialog.item)}
          title={`Delete ${dialog.item.kind}`}
          onCancel={() => setDialog(null)}
          onConfirm={() => void confirmDeleteItem(dialog.item)}
        />
      ) : null}

      <ToastStack
        toasts={toasts}
        onDismiss={(toastId) => setToasts((current) => current.filter((toast) => toast.id !== toastId))}
      />
    </div>
  )
}

export default App
