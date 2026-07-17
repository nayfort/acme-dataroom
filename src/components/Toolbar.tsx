import { ChevronRight, FolderPlus, LoaderCircle, Search, Upload } from 'lucide-react'
import type { Dataroom, FolderItem } from '../types'
import { Button } from './Button'

interface ToolbarProps {
  dataroom: Dataroom
  breadcrumbs: FolderItem[]
  query: string
  isUploading: boolean
  onQueryChange: (query: string) => void
  onNavigateRoot: () => void
  onNavigateFolder: (folderId: string) => void
  onNewFolder: () => void
  onUploadClick: () => void
}

export function Toolbar({
  dataroom,
  breadcrumbs,
  query,
  isUploading,
  onQueryChange,
  onNavigateRoot,
  onNavigateFolder,
  onNewFolder,
  onUploadClick,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__path">
        <button type="button" onClick={onNavigateRoot}>
          {dataroom.name}
        </button>
        {breadcrumbs.map((folder) => (
          <span key={folder.id} className="breadcrumb">
            <ChevronRight size={16} />
            <button type="button" onClick={() => onNavigateFolder(folder.id)}>
              {folder.name}
            </button>
          </span>
        ))}
      </div>

      <div className="toolbar__actions">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search files and folders"
            placeholder="Search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <Button onClick={onNewFolder}>
          <FolderPlus size={17} />
          New folder
        </Button>
        <Button disabled={isUploading} variant="primary" onClick={onUploadClick}>
          {isUploading ? <LoaderCircle className="spin-icon" size={17} /> : <Upload size={17} />}
          {isUploading ? 'Uploading...' : 'Upload PDF'}
        </Button>
      </div>
    </header>
  )
}
