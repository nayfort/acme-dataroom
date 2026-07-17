# Acme Dataroom

A single-page React/TypeScript data room MVP for managing due diligence folders and PDF files. The app runs fully in the browser: folder/file metadata is saved to `localStorage`, and uploaded PDF blobs are saved in IndexedDB.

## Features

- Create multiple datarooms.
- Create nested folders.
- Upload one or more validated PDF files by picker or drag-and-drop.
- View uploaded PDFs in an in-app preview drawer.
- Rename folders and files.
- Delete folders with all nested folders/files.
- Delete file blobs from IndexedDB when their metadata is removed.
- Auto-suffix duplicate upload names, for example `SPA.pdf` and `SPA (1).pdf`.
- Block duplicate names on rename to prevent accidental ambiguity.
- Search files and folders by name across the active dataroom.

## Tech Stack

- Vite
- React
- TypeScript
- Plain CSS
- Lucide React icons
- Vitest for domain model tests

I kept the stack intentionally small. The task is frontend-focused and allows mocked persistence, so the app uses browser-native storage instead of a mock backend. The metadata/blob split mirrors a real implementation where metadata would live in an API database and binary files would live in object storage.

## Data Model

The metadata is stored as flat records:

- `datarooms[]` contains top-level workspaces.
- `items[]` contains both folders and files.
- Every item has `dataroomId` and `parentId`, where `parentId: null` means the dataroom root.
- Files additionally store `blobId`, `size`, `mimeType`, and `originalName`.

This structure keeps lookup, search, duplicate detection, and cascade delete straightforward. Nested rendering is derived from `parentId`; nested deletion walks descendants and returns affected `blobId`s so the storage layer can clean up binary files.

## Requirement Coverage

| Requirement | Implementation |
| --- | --- |
| Build a dataroom frontend SPA | Vite + React + TypeScript single-page app |
| Create datarooms | Sidebar create action with duplicate-name suffixing |
| Create nested folders | Folder creation works at the dataroom root and inside any folder |
| View folders and contents | Breadcrumb navigation and table view for each folder level |
| Update folder name | Rename dialog with duplicate sibling protection |
| Delete folder and nested contents | Confirm dialog performs cascade delete and blob cleanup |
| Upload files | Multi-file PDF upload via picker or drag-and-drop |
| Support PDF only | Extension/MIME screening plus `%PDF-` signature validation |
| View file in UI | In-app PDF preview drawer using the stored browser blob |
| Update file name | Rename dialog preserves `.pdf` extension when needed |
| Delete file | Confirm dialog removes file metadata and IndexedDB blob |
| Mock persistence | `localStorage` for metadata and IndexedDB for file blobs |
| Extra credit search | Name-based search across the active dataroom |

## Edge Cases Covered

- Duplicate names on upload are renamed deterministically.
- Duplicate names on rename are blocked to avoid ambiguous folders.
- Empty files and renamed non-PDF files are rejected.
- Deleting a folder closes a preview if the previewed file was inside that folder.
- Upload actions are disabled while an upload is already in progress.
- Missing local blobs show a clear preview error instead of crashing.

## Setup

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## Deployment

This repository is deployed on Versel as required by the test task.

## Notes on AI Assistance

AI helped generate the first pass of the UI and model scaffolding. One mistake it made was treating duplicate filenames as a rename concern only, which would let two uploaded PDFs with the same name appear identical. I caught that while mapping the upload flow and moved duplicate handling into the `addFiles` domain function, where it has access to the current sibling list and can safely create names like `Document (1).pdf`.
