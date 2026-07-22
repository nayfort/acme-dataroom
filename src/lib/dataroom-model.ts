import type {
  AppState,
  Dataroom,
  DataroomId,
  DataroomItem,
  FileItem,
  FileUploadInput,
  FolderItem,
  ItemId,
} from '../types'
import { makeId } from './id'

const INVALID_NAME_CHARS = /[\\/:*?"<>|]+/g
const PDF_SIGNATURE = '%PDF-'

function timestamp() {
  return new Date().toISOString()
}

function touchDataroom(state: AppState, dataroomId: DataroomId, updatedAt = timestamp()) {
  return {
    ...state,
    datarooms: state.datarooms.map((room) =>
      room.id === dataroomId ? { ...room, updatedAt } : room,
    ),
  }
}

function folderItem(
  id: ItemId,
  dataroomId: DataroomId,
  parentId: ItemId | null,
  name: string,
  createdAt: string,
): FolderItem {
  return {
    id,
    dataroomId,
    parentId,
    name,
    kind: 'folder',
    createdAt,
    updatedAt: createdAt,
  }
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase()
}

function splitFileName(name: string, kind: DataroomItem['kind']) {
  if (kind === 'folder') return { stem: name, extension: '' }

  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) return { stem: name, extension: '' }

  return {
    stem: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  }
}

export function sanitizeEntityName(name: string, kind: DataroomItem['kind']) {
  const fallback = kind === 'folder' ? 'Untitled folder' : 'Untitled.pdf'
  const cleanName = name.trim().replace(/\s+/g, ' ').replace(INVALID_NAME_CHARS, '-')
  const safeName = cleanName.length > 0 ? cleanName : fallback

  if (kind === 'file' && !safeName.toLowerCase().endsWith('.pdf')) {
    return `${safeName}.pdf`
  }

  return safeName
}

export function makeUniqueName(
  requestedName: string,
  siblings: DataroomItem[],
  kind: DataroomItem['kind'],
) {
  const safeName = sanitizeEntityName(requestedName, kind)
  const siblingNames = new Set(siblings.map((item) => normalizeName(item.name)))

  if (!siblingNames.has(normalizeName(safeName))) {
    return safeName
  }

  const { stem, extension } = splitFileName(safeName, kind)

  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = `${stem} (${suffix})${extension}`
    if (!siblingNames.has(normalizeName(candidate))) {
      return candidate
    }
  }

  return `${stem} (${Date.now()})${extension}`
}

function makeUniqueDataroomName(requestedName: string, datarooms: Dataroom[]) {
  const safeName = sanitizeEntityName(requestedName, 'folder')
  const existingNames = new Set(datarooms.map((room) => normalizeName(room.name)))

  if (!existingNames.has(normalizeName(safeName))) {
    return safeName
  }

  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = `${safeName} (${suffix})`
    if (!existingNames.has(normalizeName(candidate))) {
      return candidate
    }
  }

  return `${safeName} (${Date.now()})`
}

export function createInitialState(createdAt = timestamp()): AppState {
  const dataroomId = makeId('room')
  const legalId = makeId('folder')
  const financeId = makeId('folder')
  const peopleId = makeId('folder')

  return {
    schemaVersion: 1,
    datarooms: [
      {
        id: dataroomId,
        name: 'Acme Corp Acquisition',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    items: [
      folderItem(legalId, dataroomId, null, 'Legal', createdAt),
      folderItem(financeId, dataroomId, null, 'Financials', createdAt),
      folderItem(peopleId, dataroomId, null, 'People', createdAt),
      folderItem(makeId('folder'), dataroomId, legalId, 'Contracts', createdAt),
      folderItem(makeId('folder'), dataroomId, financeId, 'Audits', createdAt),
    ],
    activeDataroomId: dataroomId,
    activeFolderId: null,
  }
}

export function getActiveDataroom(state: AppState) {
  return state.datarooms.find((room) => room.id === state.activeDataroomId) ?? state.datarooms[0]
}

export function getItemCountsByRoom(state: AppState) {
  const counts = new Map<string, number>()

  for (const room of state.datarooms) {
    counts.set(room.id, 0)
  }

  for (const item of state.items) {
    counts.set(item.dataroomId, (counts.get(item.dataroomId) ?? 0) + 1)
  }

  return counts
}

export function getItem(state: AppState, itemId: ItemId) {
  return state.items.find((item) => item.id === itemId)
}

export function sortItems(items: DataroomItem[]) {
  return [...items].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

export function getChildren(
  state: AppState,
  dataroomId: DataroomId,
  parentId: ItemId | null,
) {
  return sortItems(
    state.items.filter((item) => item.dataroomId === dataroomId && item.parentId === parentId),
  )
}

export function createDataroom(state: AppState, name: string) {
  const now = timestamp()
  const room: Dataroom = {
    id: makeId('room'),
    name: makeUniqueDataroomName(name, state.datarooms),
    createdAt: now,
    updatedAt: now,
  }

  return {
    state: {
      ...state,
      datarooms: [...state.datarooms, room],
      activeDataroomId: room.id,
      activeFolderId: null,
    },
    room,
  }
}

export function selectDataroom(state: AppState, dataroomId: DataroomId): AppState {
  if (!state.datarooms.some((room) => room.id === dataroomId)) return state

  return {
    ...state,
    activeDataroomId: dataroomId,
    activeFolderId: null,
  }
}

export function selectFolder(state: AppState, folderId: ItemId | null): AppState {
  if (folderId === null) {
    return { ...state, activeFolderId: null }
  }

  const folder = getItem(state, folderId)
  if (!folder || folder.kind !== 'folder' || folder.dataroomId !== state.activeDataroomId) {
    return state
  }

  return { ...state, activeFolderId: folder.id }
}

export function canReceiveChildren(
  state: AppState,
  dataroomId: DataroomId,
  parentId: ItemId | null,
) {
  if (!state.datarooms.some((room) => room.id === dataroomId)) return false
  if (parentId === null) return true

  return state.items.some(
    (item) => item.id === parentId && item.kind === 'folder' && item.dataroomId === dataroomId,
  )
}

export function addFolder(
  state: AppState,
  dataroomId: DataroomId,
  parentId: ItemId | null,
  requestedName: string,
) {
  const now = timestamp()
  const siblings = state.items.filter(
    (item) => item.dataroomId === dataroomId && item.parentId === parentId,
  )
  const item = folderItem(
    makeId('folder'),
    dataroomId,
    parentId,
    makeUniqueName(requestedName, siblings, 'folder'),
    now,
  )
  const stateWithItem = {
    ...state,
    items: [...state.items, item],
  }

  return {
    state: touchDataroom(stateWithItem, dataroomId, now),
    item,
  }
}

export function addFiles(
  state: AppState,
  dataroomId: DataroomId,
  parentId: ItemId | null,
  files: FileUploadInput[],
) {
  const now = timestamp()
  const nextItems = [...state.items]
  const created: FileItem[] = []

  for (const file of files) {
    const siblings = nextItems.filter(
      (item) => item.dataroomId === dataroomId && item.parentId === parentId,
    )
    const item: FileItem = {
      id: makeId('file'),
      dataroomId,
      parentId,
      kind: 'file',
      blobId: file.blobId,
      originalName: file.originalName,
      name: makeUniqueName(file.name, siblings, 'file'),
      mimeType: 'application/pdf',
      size: file.size,
      createdAt: now,
      updatedAt: now,
    }

    nextItems.push(item)
    created.push(item)
  }

  return {
    state: touchDataroom({ ...state, items: nextItems }, dataroomId, now),
    items: created,
  }
}

export function renameItem(state: AppState, itemId: ItemId, requestedName: string) {
  const target = getItem(state, itemId)
  if (!target) return { state, error: 'Item not found.' }

  const safeName = sanitizeEntityName(requestedName, target.kind)
  const siblings = state.items.filter(
    (item) =>
      item.id !== target.id &&
      item.dataroomId === target.dataroomId &&
      item.parentId === target.parentId,
  )
  const duplicate = siblings.some((item) => normalizeName(item.name) === normalizeName(safeName))

  if (duplicate) {
    return {
      state,
      error: 'A file or folder with this name already exists in the current folder.',
    }
  }

  const now = timestamp()
  const updatedItem = { ...target, name: safeName, updatedAt: now }
  const nextState = {
    ...state,
    items: state.items.map((item) => (item.id === target.id ? updatedItem : item)),
  }

  return {
    state: touchDataroom(nextState, target.dataroomId, now),
    item: updatedItem,
  }
}

export function getDescendantItems(state: AppState, itemId: ItemId) {
  const deletedIds = new Set<ItemId>([itemId])
  let foundMore = true

  while (foundMore) {
    foundMore = false
    for (const item of state.items) {
      if (item.parentId && deletedIds.has(item.parentId) && !deletedIds.has(item.id)) {
        deletedIds.add(item.id)
        foundMore = true
      }
    }
  }

  return state.items.filter((item) => deletedIds.has(item.id))
}

export function deleteItemTree(state: AppState, itemId: ItemId) {
  const target = getItem(state, itemId)
  if (!target) {
    return { state, deletedFileBlobIds: [] as string[], deletedItems: [] as DataroomItem[] }
  }

  const deletedItems = getDescendantItems(state, itemId)
  const deletedIds = new Set(deletedItems.map((item) => item.id))
  const deletedFileBlobIds = deletedItems
    .filter((item): item is FileItem => item.kind === 'file')
    .map((item) => item.blobId)
  const now = timestamp()
  const nextActiveFolderId =
    state.activeFolderId && deletedIds.has(state.activeFolderId)
      ? target.parentId
      : state.activeFolderId

  const nextState = {
    ...state,
    activeFolderId: nextActiveFolderId,
    items: state.items.filter((item) => !deletedIds.has(item.id)),
  }

  return {
    state: touchDataroom(nextState, target.dataroomId, now),
    deletedFileBlobIds,
    deletedItems,
  }
}

export function getMoveDestinationFolders(
  state: AppState,
  dataroomId: DataroomId,
  itemIds: ItemId[],
) {
  const blockedIds = new Set<ItemId>(itemIds)

  for (const itemId of itemIds) {
    const item = getItem(state, itemId)
    if (item?.kind === 'folder') {
      for (const descendant of getDescendantItems(state, item.id)) {
        blockedIds.add(descendant.id)
      }
    }
  }

  return sortItems(
    state.items.filter(
      (item): item is FolderItem =>
        item.kind === 'folder' && item.dataroomId === dataroomId && !blockedIds.has(item.id),
    ),
  )
}

export function moveItems(
  state: AppState,
  itemIds: ItemId[],
  targetParentId: ItemId | null,
) {
  const movingIds = [...new Set(itemIds)]
  if (movingIds.length === 0) {
    return { state, movedItems: [] as DataroomItem[], error: 'Select at least one item to move.' }
  }

  const movingItems = movingIds
    .map((itemId) => getItem(state, itemId))
    .filter((item): item is DataroomItem => Boolean(item))

  if (movingItems.length !== movingIds.length) {
    return { state, movedItems: [] as DataroomItem[], error: 'Some selected items no longer exist.' }
  }

  const dataroomId = movingItems[0].dataroomId
  if (movingItems.some((item) => item.dataroomId !== dataroomId)) {
    return { state, movedItems: [] as DataroomItem[], error: 'Items can only be moved inside one dataroom.' }
  }

  const targetFolder =
    targetParentId === null
      ? null
      : state.items.find(
          (item) =>
            item.id === targetParentId &&
            item.kind === 'folder' &&
            item.dataroomId === dataroomId,
        )

  if (targetParentId !== null && !targetFolder) {
    return { state, movedItems: [] as DataroomItem[], error: 'The destination folder no longer exists.' }
  }

  const blockedDestinationIds = new Set<ItemId>()
  for (const item of movingItems) {
    blockedDestinationIds.add(item.id)
    if (item.kind === 'folder') {
      for (const descendant of getDescendantItems(state, item.id)) {
        blockedDestinationIds.add(descendant.id)
      }
    }
  }

  if (targetParentId && blockedDestinationIds.has(targetParentId)) {
    return {
      state,
      movedItems: [] as DataroomItem[],
      error: 'A folder cannot be moved into itself or its own subfolder.',
    }
  }

  const now = timestamp()
  const availableSiblings = state.items.filter(
    (item) =>
      item.dataroomId === dataroomId &&
      item.parentId === targetParentId &&
      !movingIds.includes(item.id),
  )
  const movedById = new Map<ItemId, DataroomItem>()

  for (const item of movingItems) {
    const movedItem = {
      ...item,
      parentId: targetParentId,
      name: makeUniqueName(item.name, [...availableSiblings, ...movedById.values()], item.kind),
      updatedAt: now,
    }
    movedById.set(item.id, movedItem)
  }

  const nextState = {
    ...state,
    items: state.items.map((item) => movedById.get(item.id) ?? item),
  }

  return {
    state: touchDataroom(nextState, dataroomId, now),
    movedItems: [...movedById.values()],
  }
}

export function searchItems(state: AppState, dataroomId: DataroomId, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return []

  return sortItems(
    state.items.filter(
      (item) =>
        item.dataroomId === dataroomId &&
        item.name.toLocaleLowerCase().includes(normalizedQuery),
    ),
  )
}

export function getFolderPath(state: AppState, folderId: ItemId | null) {
  const path: FolderItem[] = []
  let currentId = folderId
  const guard = new Set<ItemId>()

  while (currentId && !guard.has(currentId)) {
    guard.add(currentId)
    const current = getItem(state, currentId)
    if (!current || current.kind !== 'folder') break
    path.unshift(current)
    currentId = current.parentId
  }

  return path
}

export function getItemLocation(state: AppState, item: DataroomItem) {
  return getFolderPath(state, item.parentId).map((folder) => folder.name)
}

export function isPdfCandidate(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export async function validatePdfFile(file: File) {
  if (!isPdfCandidate(file)) {
    return 'Only PDF files are supported.'
  }

  if (file.size === 0) {
    return 'Empty PDF files cannot be uploaded.'
  }

  try {
    const signature = await file.slice(0, PDF_SIGNATURE.length).text()
    if (signature !== PDF_SIGNATURE) {
      return 'This file does not look like a valid PDF.'
    }
  } catch {
    return 'The browser could not inspect this PDF.'
  }

  return null
}
