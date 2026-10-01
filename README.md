# Joinery

**Fit your data together.**  
**BY FLYINGBEAR**

Joinery is a standalone desktop data-modeling application focused on productive, vendor-neutral logical modeling. It replaces the repetitive work of creating ER diagrams in general-purpose drawing tools while preserving the modeling depth expected from classic desktop tools. The physical-model and reverse-engineering sequence is tracked in [`docs/CLASSIC_MODELER_ROADMAP.md`](docs/CLASSIC_MODELER_ROADMAP.md).

## Modeling capabilities

- Native SVG entity cards with ordered attributes
- Generic and reusable logical type/domain library
- Required and optional attributes with business definitions
- Primary, alternate, and composite identifiers
- Association and subtype/supertype relationships
- Recursive relationships
- N-ary relationships (three or more participants) rendered as a labelled hub with one leg per entity
- Crow's Foot cardinality at both ends, including exact-N ("exactly N") values
- Per-participant role names and attribute mappings on n-ary legs
- Optional attribute-to-attribute endpoint mappings
- Identifying and non-identifying semantics
- Relationship role names and descriptions
- Inversion entries: named, non-identifying access paths (attribute sets) per entity
- Obstacle-aware routing with editable, diagram-specific waypoints
- Model validation and issue navigation
- Logical model comparison against another `.joinery` document with selective, checkbox-driven merge

## Diagram capabilities

- Multiple diagrams over one canonical model
- Per-diagram entity visibility
- Rename, duplicate, and delete diagrams
- Entity search across names, descriptions, attributes, and types
- Per-entity preset or custom colors, collapse/expand, and pinning
- ELK automatic layout in a Web Worker
- Diagram notes and subject-area frames
- Entity-attached comments — sticky notes that anchor to an entity, follow it when it moves, and hide or delete with it
- Crow's Foot notation legend
- Pan, zoom, fit-to-view, selection, and keyboard navigation
- Light and dark themes

## Productivity and safety

- Canonical command history with undo and redo
- Copy, paste, and duplicate entities
- Keyboard-first attribute insertion and reordering, plus drag-to-reorder and one-click "Arrange" presets (keys & FKs first, alphabetical)
- Bulk attribute import by pasting spreadsheet, CSV, or plain-text rows into an editable staging grid — fix names, types, PK/Required flags, row order, and entity references before committing; or add rows manually
- Explicit relationship dialog or direct port-to-port drawing
- Versioned `.joinery` JSON documents with strict runtime validation
- Native New/Open/Save/Save As and atomic file replacement
- File association and single-instance open handling
- Debounced crash-recovery snapshots
- Destructive-action confirmation and status notifications

## Output and documentation

- Content-bounded SVG export
- PNG export at 1×, 2×, or 3× resolution
- Vector PDF export sized to content, A4, or A3
- Multi-page tiled A4 PDF output for large diagrams
- White or transparent backgrounds and live export preview
- Mermaid `erDiagram` (.mmd) export and import
- drawio (.drawio) export with one page per diagram and Crow's Foot markers, plus best-effort drawio import
- Printable HTML model reports
- CSV data-dictionary reports

## Stack

- Tauri 2 and Rust
- React 19, TypeScript, and Vite
- AntV X6
- ELK.js in a Web Worker
- Zustand, Immer, and Zod
- Rust `resvg`, `svg2pdf`, and `pdf-writer`
- Vitest, Testing Library, and Playwright

## Development

### Prerequisites

- Node.js and npm
- Rust via `rustup`
- macOS Tauri prerequisites, including Xcode Command Line Tools

See the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for platform-specific details.

### Install and run

```bash
npm install

# Browser UI development
npm run dev

# Native desktop development
npm run tauri dev
```

### Verify

```bash
npm run check
npm run test:e2e
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

### Build

```bash
npm run tauri build
```

Signing, notarization, updater configuration, and release secrets are documented in [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md).

## Controls

- Drag empty canvas space to pan; use the mouse wheel or trackpad to zoom.
- Hover an entity to reveal its relationship ports.
- Drag between ports aligned with attribute rows to map specific attributes.
- Use entity-edge ports when a relationship should remain entity-level.
- Click a relationship line—or select it in the Relationships navigator—to edit it.
- Select a relationship and drag its purple handles to define a custom route.
- Single-click an entity in the navigator to select it; double-click to center it.
- Press `Enter` in an attribute-name field to insert the next attribute.
- Press `Option/Alt + Arrow Up/Down` to reorder an attribute; `Shift`-click the arrow buttons to jump an attribute to the top or bottom; or drag a row by its grip handle. The **Arrange…** menu in the Attributes heading re-sorts the whole list (keys & FKs first, A–Z) in one undoable step.
- Press `Cmd/Ctrl + Z` to undo and `Shift + Cmd/Ctrl + Z` to redo.
- Press `Cmd/Ctrl + C` and `Cmd/Ctrl + V` to copy/paste a selected entity.
- Press `Cmd/Ctrl + V` with pasted spreadsheet rows to bulk-add attributes to the selected entity—or use the **Paste** button in the Attributes section. Edit the staging grid inline: rename, change types, flag PK/Required, or pick a referenced entity to auto-create identifying relationships.
- Select an entity and use **Add comment** in its inspector to attach a review comment that follows the entity on the diagram.
- Press `Cmd/Ctrl + Enter` in the paste dialog to confirm the import.
- Press `Cmd/Ctrl + D` to duplicate a selected entity.
- Press `Delete` or `Backspace` to remove the selection.
- Press `Cmd/Ctrl + E` to add an entity.
- Press `Shift + Cmd/Ctrl + E` to open diagram export (SVG, PNG, PDF, Mermaid, drawio).
- Use the toolbar **Import** button to load a Mermaid `.mmd` or drawio `.drawio` file as a new model.
- Press `Cmd/Ctrl + 0` to fit the diagram.
- Press `Cmd/Ctrl + N`, `O`, or `S` for document operations.
- Press `Cmd/Ctrl + Q` or use the toolbar quit action to exit Joinery.

## Project structure

```text
src/domain/               Canonical model, validation, comparison, reports
src/state/                Command history, project state, document and UI state
src/diagram/              X6 projection, SVG shapes, routing, ELK worker, export
src/native/               Typed frontend adapters for native document/export I/O
src/components/           Desktop shell, inspectors, dialogs, and navigators
src-tauri/                Atomic file I/O, PNG/PDF rendering, desktop lifecycle
src-tauri/tests/fixtures/  Native export compatibility fixtures
e2e/                      Browser-level interaction tests
docs/COMPACT_MEMORY.md     Concise handoff for resumed/compacted sessions
docs/PROJECT_MEMORY.md     Durable decisions and constraints
.github/workflows/         macOS/Windows CI and draft release builds
```

## Architecture principle

The X6 graph is a visual projection, never the source of truth. The canonical logical model is independent from diagram layout, so the same entities and relationships can appear in many views without duplication. Undo/redo, persistence, recovery, comparison, validation, and reports all operate on that canonical model.
