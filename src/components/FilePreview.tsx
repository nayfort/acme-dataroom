import { Download, FileText, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBytes } from '../lib/format'
import { fileUrl } from '../lib/api'
import type { FileItem } from '../types'
import { Button } from './Button'

interface FilePreviewProps {
  file: FileItem
  onClose: () => void
  onRename: (file: FileItem) => void
  onDelete: (file: FileItem) => void
}

export function FilePreview({ file, onClose, onRename, onDelete }: FilePreviewProps) {
  const [error, setError] = useState('')
  const pdfUrl = fileUrl(file.blobId)

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
    setError('')
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
          <a className="icon-link" href={pdfUrl} download={file.name} title="Download">
            <Download size={17} />
          </a>
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
        ) : (
          <iframe
            src={pdfUrl}
            title={file.name}
            onError={() => setError('Could not load this PDF from server storage.')}
          />
        )}
      </div>
    </aside>
  )
}
