import { LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { AuthPanel } from './components/AuthPanel'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ContentPane } from './components/ContentPane'
import { FilePreview } from './components/FilePreview'
import { MoveDialog, type MoveDestination } from './components/MoveDialog'
import { NameDialog } from './components/NameDialog'
import { Sidebar } from './components/Sidebar'
import { ToastStack, type ToastMessage } from './components/Toast'
import { Toolbar } from './components/Toolbar'
import {
  createDataroomRequest,
  createFolderRequest,
  deleteItemRequest,
  fetchDataroomState,
  getSession,
  logout,
  moveItemsRequest,
  renameItemRequest,
  uploadPdfRequest,
} from './lib/api'
import {
  canReceiveChildren,
  getActiveDataroom,
  getChildren,
  getDescendantItems,
  getFolderPath,
  getItem,
  getItemCountsByRoom,
  getItemLocation,
  getMoveDestinationFolders,
  searchItems,
  selectDataroom,
  selectFolder,
  validatePdfFile,
} from './lib/dataroom-model'
import { pluralize } from './lib/format'
import { makeId } from './lib/id'
import type { AppState, DataroomItem, FileItem, User } from './types'

type DialogState =
  | { type: 'create-dataroom' }
  | { type: 'create-folder' }
  | { type: 'rename-item'; item: DataroomItem }
  | { type: 'delete-item'; item: DataroomItem }
  | { type: 'move-items'; items: DataroomItem[] }
  | null

interface DataroomWorkspaceProps {
  state: AppState
  user: User
  onSignedOut: () => void
  onStateChange: (state: AppState) => void
}

function getErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  return error instanceof Error ? error.message : fallback
}

function preserveActiveView(
  nextState: AppState,
  currentState: AppState,
  overrides: Partial<Pick<AppState, 'activeDataroomId' | 'activeFolderId'>> = {},
) {
  const requestedDataroomId = overrides.activeDataroomId ?? currentState.activeDataroomId
  const activeDataroomId = nextState.datarooms.some((room) => room.id === requestedDataroomId)
    ? requestedDataroomId
    : nextState.datarooms[0]?.id
  const requestedFolderId =
    Object.hasOwn(overrides, 'activeFolderId') ? overrides.activeFolderId : currentState.activeFolderId
  const activeFolderId =
    requestedFolderId &&
    nextState.items.some(
      (item) =>
        item.kind === 'folder' &&
        item.id === requestedFolderId &&
        item.dataroomId === activeDataroomId,
    )
      ? requestedFolderId
      : null

  return {
    ...nextState,
    activeDataroomId,
    activeFolderId,
  }
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="loading-screen">
      <LoaderCircle className="spin-icon" size={26} />
      <span>{message}</span>
    </main>
  )
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [state, setState] = useState<AppState | null>(null)
  const [isBooting, setBooting] = useState(true)
  const [bootError, setBootError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const session = await getSession()
        if (cancelled) return

        if (!session.user) {
          setUser(null)
          setState(null)
          return
        }

        const result = await fetchDataroomState()
        if (cancelled) return

        setUser(session.user)
        setState(result.state)
      } catch (error) {
        if (!cancelled) {
          setBootError(getErrorMessage(error, 'Could not reach the dataroom server.'))
        }
      } finally {
        if (!cancelled) {
          setBooting(false)
        }
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleAuthenticated(nextUser: User) {
    setBootError('')
    setBooting(true)

    try {
      const result = await fetchDataroomState()
      setUser(nextUser)
      setState(result.state)
    } catch (error) {
      setBootError(getErrorMessage(error, 'Could not load datarooms.'))
    } finally {
      setBooting(false)
    }
  }

  if (isBooting) {
    return <LoadingScreen message="Opening dataroom..." />
  }

  if (!user || !state) {
    return (
      <>
        <AuthPanel onAuthenticated={(nextUser) => void handleAuthenticated(nextUser)} />
        {bootError ? <div className="auth-error">{bootError}</div> : null}
      </>
    )
  }

  return (
    <DataroomWorkspace
      state={state}
      user={user}
      onSignedOut={() => {
        setUser(null)
        setState(null)
      }}
      onStateChange={setState}
    />
  )
}

function DataroomWorkspace({
  state,
  user,
  onSignedOut,
  onStateChange,
}: DataroomWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
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
  const selectedItems = useMemo(
    () =>
      selectedItemIds
        .map((itemId) => getItem(state, itemId))
        .filter((item): item is DataroomItem => Boolean(item)),
    [selectedItemIds, state],
  )

  useEffect(() => {
    const validIds = new Set(state.items.map((item) => item.id))
    setSelectedItemIds((current) => current.filter((itemId) => validIds.has(itemId)))
  }, [state.items])

  function applyServerState(
    nextState: AppState,
    overrides: Partial<Pick<AppState, 'activeDataroomId' | 'activeFolderId'>> = {},
  ) {
    onStateChange(preserveActiveView(nextState, state, overrides))
  }

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

  async function createRoom(name: string) {
    try {
      const result = await createDataroomRequest(name)
      applyServerState(result.state, { activeDataroomId: result.room.id, activeFolderId: null })
      setQuery('')
      setPreviewFileId(null)
      setSelectedItemIds([])
      showToast(`Created dataroom "${result.room.name}".`, 'success')
    } catch (error) {
      return getErrorMessage(error, 'Could not create dataroom.')
    }
  }

  async function createFolder(name: string) {
    if (!activeDataroom) return 'No active dataroom.'

    try {
      const result = await createFolderRequest(activeDataroom.id, activeFolderId, name)
      applyServerState(result.state, {
        activeDataroomId: activeDataroom.id,
        activeFolderId,
      })
      showToast(`Created folder "${result.item.name}".`, 'success')
    } catch (error) {
      return getErrorMessage(error, 'Could not create folder.')
    }
  }

  async function renameExistingItem(item: DataroomItem, name: string) {
    try {
      const result = await renameItemRequest(item.id, name)
      applyServerState(result.state)
      showToast(`Renamed to "${result.item.name}".`, 'success')
    } catch (error) {
      return getErrorMessage(error, 'Could not rename this item.')
    }
  }

  async function confirmDeleteItem(item: DataroomItem) {
    try {
      const result = await deleteItemRequest(item.id)
      applyServerState(result.state)
      setDialog(null)
      setSelectedItemIds((current) =>
        current.filter((itemId) => !result.deletedItems.some((deletedItem) => deletedItem.id === itemId)),
      )

      if (previewFileId && result.deletedItems.some((deletedItem) => deletedItem.id === previewFileId)) {
        setPreviewFileId(null)
      }

      showToast(`Deleted "${item.name}".`, 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not delete this item.'), 'error')
    }
  }

  async function moveChosenItems(items: DataroomItem[], targetParentId: string | null) {
    try {
      const result = await moveItemsRequest(
        items.map((item) => item.id),
        targetParentId,
      )
      applyServerState(result.state)
      setSelectedItemIds([])
      showToast(`${pluralize(result.movedItems.length, 'item', 'items')} moved.`, 'success')
    } catch (error) {
      return getErrorMessage(error, 'Could not move selected items.')
    }
  }

  async function moveIntoFolder(itemId: string, targetFolderId: string) {
    const item = getItem(state, itemId)
    if (!item) return

    if (item.parentId === targetFolderId) {
      showToast(`"${item.name}" is already in that folder.`, 'info')
      return
    }

    const error = await moveChosenItems([item], targetFolderId)
    if (error) {
      showToast(error, 'error')
    }
  }

  async function handleUploadFiles(fileList: FileList) {
    if (!activeDataroom) return

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

    let latestState: AppState | null = null
    let uploadedCount = 0

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

      for (const file of acceptedFiles) {
        const result = await uploadPdfRequest(file, targetDataroomId, targetFolderId)
        latestState = result.state
        uploadedCount += 1
      }

      if (latestState) {
        applyServerState(latestState, {
          activeDataroomId: targetDataroomId,
          activeFolderId: targetFolderId,
        })
      }

      showToast(`${pluralize(uploadedCount, 'PDF', 'PDFs')} uploaded.`, 'success')

      if (rejectedFiles.length > 0) {
        showToast(
          `${pluralize(rejectedFiles.length, 'file was', 'files were')} skipped: ${summarizeFileNames(
            rejectedFiles.map((entry) => entry.file.name),
          )}.`,
          'error',
        )
      }
    } catch (error) {
      if (latestState) {
        applyServerState(latestState, {
          activeDataroomId: targetDataroomId,
          activeFolderId: targetFolderId,
        })
      }
      showToast(getErrorMessage(error, 'Upload failed. The server could not store the PDF.'), 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      onSignedOut()
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

  function buildMoveDestinations(items: DataroomItem[]): MoveDestination[] {
    if (!activeDataroom) return []

    const movingIds = items.map((item) => item.id)
    const folders = getMoveDestinationFolders(state, activeDataroom.id, movingIds)

    return [
      { id: null, label: `${activeDataroom.name} / Root` },
      ...folders.map((folder) => ({
        id: folder.id,
        label: [activeDataroom.name, ...getFolderPath(state, folder.id).map((pathItem) => pathItem.name)].join(' / '),
      })),
    ]
  }

  function getInitialMoveDestination(items: DataroomItem[]) {
    const [firstItem] = items
    if (!firstItem) return null

    return items.every((item) => item.parentId === firstItem.parentId) ? firstItem.parentId : null
  }

  if (!activeDataroom) {
    return <LoadingScreen message="Loading dataroom..." />
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
        user={user}
        onCreate={() => setDialog({ type: 'create-dataroom' })}
        onLogout={() => void handleLogout()}
        onSelect={(dataroomId) => {
          onStateChange(selectDataroom(state, dataroomId))
          setQuery('')
          setPreviewFileId(null)
          setSelectedItemIds([])
        }}
      />

      <section className="workspace">
        <Toolbar
          breadcrumbs={breadcrumbs}
          dataroom={activeDataroom}
          query={query}
          onNavigateFolder={(folderId) => {
            onStateChange(selectFolder(state, folderId))
            setQuery('')
            setSelectedItemIds([])
          }}
          onNavigateRoot={() => {
            onStateChange(selectFolder(state, null))
            setQuery('')
            setSelectedItemIds([])
          }}
          onNewFolder={() => setDialog({ type: 'create-folder' })}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery)
            setSelectedItemIds([])
          }}
          onUploadClick={openUploadPicker}
          isUploading={isUploading}
        />

        <ContentPane
          isSearching={Boolean(query.trim())}
          isUploading={isUploading}
          items={visibleItems}
          locationForItem={(item) => getItemLocation(state, item).join(' / ')}
          query={query}
          selectedItemIds={selectedItemIds}
          onClearSelection={() => setSelectedItemIds([])}
          onDelete={(item) => setDialog({ type: 'delete-item', item })}
          onDropFiles={(files) => void handleUploadFiles(files)}
          onMoveIntoFolder={(itemId, targetFolderId) => void moveIntoFolder(itemId, targetFolderId)}
          onMoveItem={(item) => setDialog({ type: 'move-items', items: [item] })}
          onMoveSelected={() => {
            if (selectedItems.length > 0) {
              setDialog({ type: 'move-items', items: selectedItems })
            }
          }}
          onOpenFolder={(folderId) => {
            onStateChange(selectFolder(state, folderId))
            setQuery('')
            setSelectedItemIds([])
          }}
          onPreviewFile={setPreviewFileId}
          onRename={(item) => setDialog({ type: 'rename-item', item })}
          onToggleSelection={(itemId) =>
            setSelectedItemIds((current) =>
              current.includes(itemId)
                ? current.filter((selectedItemId) => selectedItemId !== itemId)
                : [...current, itemId],
            )
          }
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

      {dialog?.type === 'move-items' ? (
        <MoveDialog
          destinations={buildMoveDestinations(dialog.items)}
          initialDestinationId={getInitialMoveDestination(dialog.items)}
          items={dialog.items}
          onClose={() => setDialog(null)}
          onMove={(targetParentId) => moveChosenItems(dialog.items, targetParentId)}
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
