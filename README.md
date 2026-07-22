# Acme Dataroom

A React/TypeScript data room for due diligence workspaces, backed by a small Node API. Users sign in, work with seeded dataroom content, upload PDFs to server storage, preview documents, and move files or folders across the room hierarchy.

## Features

- Cookie-based sign-in, registration, and logout.
- Seeded demo users and populated datarooms on first server start.
- Create multiple datarooms and nested folders.
- Upload one or more validated PDF files by picker or drag-and-drop.
- Store metadata in `server/data/db.json` and PDFs in `server/data/pdfs`.
- View PDFs in an in-app preview drawer served from the API.
- Rename folders and files with duplicate sibling protection.
- Move files/folders by row action, multi-select dialog, or drag-and-drop onto folders.
- Delete folders with all nested folders/files and clean up uploaded PDF files.
- Search files and folders by name across the active dataroom.
- UI motion for auth, dialogs, drawers, row updates, drag targets, and toasts.

## Demo Access

```text
analyst@acme.test / dataroom123
partner@acme.test / dataroom123
```

New registered users receive the same seeded dataroom structure.

## Tech Stack

- Vite
- React
- TypeScript
- Plain CSS
- Node HTTP API with file-backed persistence
- Lucide React icons
- Vitest for domain model tests

## Data Model

The app keeps metadata as flat records:

- `datarooms[]` contains top-level workspaces.
- `items[]` contains both folders and files.
- Every item has `dataroomId` and `parentId`, where `parentId: null` means the dataroom root.
- Files additionally store `blobId`, `size`, `mimeType`, and `originalName`.

The server owns persistence and authentication. Browser storage is not used for dataroom data.

## Setup

Install dependencies:

```bash
npm install
```

Start the API and Vite client together:

```bash
npm run dev
```

Then open the local URL printed by Vite.

For separate terminals, use `npm run dev:api` and `npm run dev:client`.

## Production Build

```bash
npm run build
npm run serve
```

`npm run serve` serves the API and the built client from `dist`.

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## Local Data

The server creates `server/data` on first run. Delete that folder to reset users, sessions, seeded PDF files, and dataroom content.
