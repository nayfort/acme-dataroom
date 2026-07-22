import { describe, expect, it } from 'vitest'
import {
  addFiles,
  addFolder,
  canReceiveChildren,
  createDataroom,
  createInitialState,
  deleteItemTree,
  getChildren,
  getMoveDestinationFolders,
  moveItems,
  renameItem,
  validatePdfFile,
} from './dataroom-model'

describe('dataroom model', () => {
  it('auto-suffixes duplicate folder and PDF names in the same folder', () => {
    const initial = createInitialState('2026-01-01T00:00:00.000Z')
    const roomId = initial.activeDataroomId
    const firstFolder = addFolder(initial, roomId, null, 'Legal')
    const upload = addFiles(firstFolder.state, roomId, null, [
      {
        blobId: 'blob_1',
        name: 'Legal.pdf',
        originalName: 'Legal.pdf',
        size: 100,
      },
      {
        blobId: 'blob_2',
        name: 'Legal.pdf',
        originalName: 'Legal.pdf',
        size: 100,
      },
    ])

    const rootChildren = getChildren(upload.state, roomId, null)

    expect(rootChildren.map((item) => item.name)).toContain('Legal')
    expect(rootChildren.map((item) => item.name)).toContain('Legal (1)')
    expect(rootChildren.map((item) => item.name)).toContain('Legal.pdf')
    expect(rootChildren.map((item) => item.name)).toContain('Legal (1).pdf')
  })

  it('blocks renaming an item to a duplicate sibling name', () => {
    const initial = createInitialState('2026-01-01T00:00:00.000Z')
    const roomId = initial.activeDataroomId
    const legal = getChildren(initial, roomId, null).find((item) => item.name === 'Legal')
    const people = getChildren(initial, roomId, null).find((item) => item.name === 'People')

    expect(legal).toBeDefined()
    expect(people).toBeDefined()

    const result = renameItem(initial, people!.id, legal!.name)

    expect(result.error).toMatch(/already exists/i)
  })

  it('auto-suffixes duplicate dataroom names', () => {
    const initial = createInitialState('2026-01-01T00:00:00.000Z')
    const first = createDataroom(initial, 'Acme Corp Acquisition')
    const second = createDataroom(first.state, 'Acme Corp Acquisition')

    expect(first.room.name).toBe('Acme Corp Acquisition (1)')
    expect(second.room.name).toBe('Acme Corp Acquisition (2)')
  })

  it('validates file extension, size, and PDF signature', async () => {
    const validPdf = new File(['%PDF-1.4\ncontent'], 'deck.pdf', { type: 'application/pdf' })
    const emptyPdf = new File([''], 'empty.pdf', { type: 'application/pdf' })
    const renamedText = new File(['not a pdf'], 'renamed.pdf', { type: 'application/pdf' })
    const plainText = new File(['%PDF-1.4\ncontent'], 'deck.txt', { type: 'text/plain' })

    await expect(validatePdfFile(validPdf)).resolves.toBeNull()
    await expect(validatePdfFile(emptyPdf)).resolves.toMatch(/empty/i)
    await expect(validatePdfFile(renamedText)).resolves.toMatch(/valid PDF/i)
    await expect(validatePdfFile(plainText)).resolves.toMatch(/only PDF/i)
  })

  it('deletes a folder tree and returns nested PDF blobs for cleanup', () => {
    const initial = createInitialState('2026-01-01T00:00:00.000Z')
    const roomId = initial.activeDataroomId
    const legal = getChildren(initial, roomId, null).find((item) => item.name === 'Legal')
    const contracts = legal
      ? getChildren(initial, roomId, legal.id).find((item) => item.name === 'Contracts')
      : undefined

    expect(legal).toBeDefined()
    expect(contracts).toBeDefined()

    const upload = addFiles(initial, roomId, contracts!.id, [
      {
        blobId: 'blob_contract',
        name: 'SPA.pdf',
        originalName: 'SPA.pdf',
        size: 2048,
      },
    ])
    const result = deleteItemTree(upload.state, legal!.id)

    expect(result.deletedFileBlobIds).toEqual(['blob_contract'])
    expect(result.state.items.some((item) => item.id === contracts!.id)).toBe(false)
  })

  it('guards uploads to deleted folders', () => {
    const initial = createInitialState('2026-01-01T00:00:00.000Z')
    const roomId = initial.activeDataroomId
    const legal = getChildren(initial, roomId, null).find((item) => item.name === 'Legal')

    expect(legal).toBeDefined()
    expect(canReceiveChildren(initial, roomId, legal!.id)).toBe(true)

    const deleted = deleteItemTree(initial, legal!.id)

    expect(canReceiveChildren(deleted.state, roomId, legal!.id)).toBe(false)
  })

  it('moves items to another folder and suffixes destination name collisions', () => {
    const initial = createInitialState('2026-01-01T00:00:00.000Z')
    const roomId = initial.activeDataroomId
    const legal = getChildren(initial, roomId, null).find((item) => item.name === 'Legal')
    const financials = getChildren(initial, roomId, null).find((item) => item.name === 'Financials')
    const contracts = legal
      ? getChildren(initial, roomId, legal.id).find((item) => item.name === 'Contracts')
      : undefined
    const audits = financials
      ? getChildren(initial, roomId, financials.id).find((item) => item.name === 'Audits')
      : undefined

    expect(contracts).toBeDefined()
    expect(audits).toBeDefined()

    const sourceUpload = addFiles(initial, roomId, contracts!.id, [
      {
        blobId: 'blob_source',
        name: 'SPA.pdf',
        originalName: 'SPA.pdf',
        size: 2048,
      },
    ])
    const destinationUpload = addFiles(sourceUpload.state, roomId, audits!.id, [
      {
        blobId: 'blob_destination',
        name: 'SPA.pdf',
        originalName: 'SPA.pdf',
        size: 2048,
      },
    ])
    const sourceFile = destinationUpload.state.items.find(
      (item) => item.kind === 'file' && item.blobId === 'blob_source',
    )
    const result = sourceFile ? moveItems(destinationUpload.state, [sourceFile.id], audits!.id) : undefined

    expect(result?.error).toBeUndefined()
    expect(result?.movedItems[0].parentId).toBe(audits!.id)
    expect(result?.movedItems[0].name).toBe('SPA (1).pdf')
  })

  it('blocks moving a folder into itself or its own descendant', () => {
    const initial = createInitialState('2026-01-01T00:00:00.000Z')
    const roomId = initial.activeDataroomId
    const legal = getChildren(initial, roomId, null).find((item) => item.name === 'Legal')
    const contracts = legal
      ? getChildren(initial, roomId, legal.id).find((item) => item.name === 'Contracts')
      : undefined

    expect(legal).toBeDefined()
    expect(contracts).toBeDefined()

    const destinations = getMoveDestinationFolders(initial, roomId, [legal!.id])
    const result = moveItems(initial, [legal!.id], contracts!.id)

    expect(destinations.some((folder) => folder.id === contracts!.id)).toBe(false)
    expect(result.error).toMatch(/cannot be moved/i)
    expect(getChildren(result.state, roomId, null).some((item) => item.id === legal!.id)).toBe(true)
  })
})
