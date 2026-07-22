export type DataroomId = string
export type ItemId = string

export interface User {
  id: string
  name: string
  email: string
}

export interface Dataroom {
  id: DataroomId
  name: string
  createdAt: string
  updatedAt: string
}

interface BaseItem {
  id: ItemId
  dataroomId: DataroomId
  parentId: ItemId | null
  name: string
  createdAt: string
  updatedAt: string
}

export interface FolderItem extends BaseItem {
  kind: 'folder'
}

export interface FileItem extends BaseItem {
  kind: 'file'
  blobId: string
  originalName: string
  mimeType: 'application/pdf'
  size: number
}

export type DataroomItem = FolderItem | FileItem

export interface AppState {
  schemaVersion: 1
  datarooms: Dataroom[]
  items: DataroomItem[]
  activeDataroomId: DataroomId
  activeFolderId: ItemId | null
}

export interface FileUploadInput {
  blobId: string
  name: string
  originalName: string
  size: number
}
