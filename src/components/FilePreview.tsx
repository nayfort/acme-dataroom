import { Download, FileText, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBytes } from '../lib/format'
import { getPdfBlob } from '../lib/pdf-store'
import type { FileItem } from '../types'
import { Button } from './Button'

interface FilePreviewProps {
  file: FileItem
  onClose: () => void
  onRename: (file: FileItem) => void
  onDelete: (file: FileItem) => void
}

export function FilePreview({ file, onClose, onRename, onDelete }: FilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let url = ''
    let cancelled = false

    setError('')
    setObjectUrl('')

    getPdfBlob(file.blobId)
      .then((blob) => {
        if (cancelled) return
        if (!blob) {
          setError('The PDF blob is missing from local browser storage.')
          return
        }

        url = URL.createObjectURL(blob)
        setObjectUrl(url)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not read this PDF from local browser storage.')
        }
      })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file.blobId])

  return (
    <aside className="preview-drawer" aria-label="PDF preview">
      <header className="preview-drawer__header">
        <div className="preview-drawer__title">
          <FileText size={19} />
          <div>
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)}</span>
          </div>
        </div>
        <div className="preview-drawer__actions">
          {objectUrl ? (
            <a className="icon-link" href={objectUrl} download={file.name} title="Download">
              <Download size={17} />
            </a>
          ) : null}
          <Button aria-label="Rename file" size="icon" title="Rename" variant="ghost" onClick={() => onRename(file)}>
            <Pencil size={17} />
          </Button>
          <Button aria-label="Delete file" size="icon" title="Delete" variant="ghost" onClick={() => onDelete(file)}>
            <Trash2 size={17} />
          </Button>
          <Button aria-label="Close preview" size="icon" title="Close" variant="ghost" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
      </header>

      <div className="preview-drawer__body">
        {error ? (
          <div className="preview-error">
            <FileText size={28} />
            <p>{error}</p>
          </div>
        ) : objectUrl ? (
          <iframe src={objectUrl} title={file.name} />
        ) : (
          <div className="preview-loading">Loading preview...</div>
        )}
      </div>
    </aside>
  )
}
