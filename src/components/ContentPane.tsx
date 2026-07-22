import {
  FileText,
  Folder,
  FolderInput,
  GripVertical,
  LoaderCircle,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cx } from '../lib/cx'
import { formatBytes, formatDate } from '../lib/format'
import type { DataroomItem } from '../types'
import { Button } from './Button'

interface ContentPaneProps {
  items: DataroomItem[]
  isSearching: boolean
  isUploading: boolean
  selectedItemIds: string[]
  query: string
  locationForItem: (item: DataroomItem) => string
  onClearSelection: () => void
  onMoveIntoFolder: (itemId: string, targetFolderId: string) => void
  onMoveItem: (item: DataroomItem) => void
  onMoveSelected: () => void
  onOpenFolder: (folderId: string) => void
  onPreviewFile: (fileId: string) => void
  onRename: (item: DataroomItem) => void
  onToggleSelection: (itemId: string) => void
  onDelete: (item: DataroomItem) => void
  onDropFiles: (files: FileList) => void
  onUploadClick: () => void
}

export function ContentPane({
  items,
  isSearching,
  isUploading,
  selectedItemIds,
  query,
  locationForItem,
  onClearSelection,
  onMoveIntoFolder,
  onMoveItem,
  onMoveSelected,
  onOpenFolder,
  onPreviewFile,
  onRename,
  onToggleSelection,
  onDelete,
  onDropFiles,
  onUploadClick,
}: ContentPaneProps) {
  const [isDragActive, setDragActive] = useState(false)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const selectedIds = new Set(selectedItemIds)

  return (
    <main
      className={isDragActive ? 'content-pane is-drag-active' : 'content-pane'}
      aria-busy={isUploading}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setDragActive(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        if (event.dataTransfer.files.length > 0) {
          onDropFiles(event.dataTransfer.files)
        }
      }}
    >
      {isDragActive ? (
        <div className="drop-overlay">
          <Upload size={24} />
          <span>Drop PDFs</span>
        </div>
      ) : null}

      <div className="content-pane__summary">
        <div>
          <strong>{isSearching ? `Search results for "${query}"` : 'Folder contents'}</strong>
          <span>{items.length} items</span>
        </div>
        {selectedItemIds.length > 0 ? (
          <div className="selection-actions">
            <span>{selectedItemIds.length} selected</span>
            <Button size="sm" variant="primary" onClick={onMoveSelected}>
              <FolderInput size={16} />
              Move
            </Button>
            <Button aria-label="Clear selection" size="icon" title="Clear selection" variant="ghost" onClick={onClearSelection}>
              <X size={16} />
            </Button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <FileText size={30} />
          <h2>{isSearching ? 'No matches found' : 'No documents here yet'}</h2>
          {!isSearching ? (
            <Button disabled={isUploading} variant="primary" onClick={onUploadClick}>
              {isUploading ? <LoaderCircle className="spin-icon" size={17} /> : <Upload size={17} />}
              {isUploading ? 'Uploading...' : 'Upload PDF'}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="item-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Size</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = selectedIds.has(item.id)
                const isDropTarget =
                  Boolean(draggedItemId) && item.kind === 'folder' && draggedItemId !== item.id

                return (
                <tr
                  key={item.id}
                  className={cx(isSelected && 'is-selected', isDropTarget && 'is-drop-target')}
                  draggable
                  onDragEnd={() => setDraggedItemId(null)}
                  onDragOver={(event) => {
                    if (isDropTarget) {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', item.id)
                    setDraggedItemId(item.id)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const sourceItemId = event.dataTransfer.getData('text/plain') || draggedItemId
                    setDraggedItemId(null)
                    if (sourceItemId && item.kind === 'folder' && sourceItemId !== item.id) {
                      onMoveIntoFolder(sourceItemId, item.id)
                    }
                  }}
                >
                  <td>
                    <div className="item-cell">
                      <label className="row-select">
                        <input
                          aria-label={`Select ${item.name}`}
                          checked={isSelected}
                          type="checkbox"
                          onChange={() => onToggleSelection(item.id)}
                        />
                      </label>
                      <button
                        className="item-name"
                        type="button"
                        onClick={() =>
                          item.kind === 'folder' ? onOpenFolder(item.id) : onPreviewFile(item.id)
                        }
                      >
                        <span className={item.kind === 'folder' ? 'item-icon item-icon--folder' : 'item-icon'}>
                          {item.kind === 'folder' ? <Folder size={18} /> : <FileText size={18} />}
                        </span>
                        <span>{item.name}</span>
                      </button>
                    </div>
                  </td>
                  <td className="muted-cell">{locationForItem(item) || 'Root'}</td>
                  <td className="muted-cell">{item.kind === 'file' ? formatBytes(item.size) : 'Folder'}</td>
                  <td className="muted-cell">{formatDate(item.updatedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Button
                        aria-label={`Move ${item.name}`}
                        size="icon"
                        title="Move"
                        variant="ghost"
                        onClick={() => onMoveItem(item)}
                      >
                        <FolderInput size={16} />
                      </Button>
                      <Button
                        aria-label={`Rename ${item.name}`}
                        size="icon"
                        title="Rename"
                        variant="ghost"
                        onClick={() => onRename(item)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        aria-label={`Delete ${item.name}`}
                        size="icon"
                        title="Delete"
                        variant="ghost"
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 size={16} />
                      </Button>
                      <GripVertical className="row-actions__handle" size={16} aria-hidden="true" />
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
