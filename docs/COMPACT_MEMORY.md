# Joinery compact project memory

Updated: 2026-10-01

## Goal

Build **Joinery — BY FLYINGBEAR**, a standalone macOS-first data-modeling application that replaces manual ER diagram work and reaches the practical depth of classic ERwin/ER/Studio-style tooling. The logical modeler is implemented; the next active phase is a separate physical-model/SQL layer.

## Product constraints

- Offline, standalone, and single-user.
- macOS first; shared code and CI remain Windows-compatible.
- Canonical vendor-neutral logical model; X6 is only its SVG projection.
- One model may appear in multiple independently arranged diagrams.
- Crow's Foot notation.
- Target scale: 100 entities and approximately 200 relationships.
- Physical schemas and SQL must be a separate layer mapped to logical objects, never fields added directly to logical entities.

## Current identity

- Product: **Joinery**
- Credit: **BY FLYINGBEAR**
- Tagline: **Fit your data together.**
- Current version: **0.1.0**, injected into the top-left UI from `package.json`
- Document extension: `.joinery`
- Bundle identifier: `app.joinery.modeler`

## Implemented logical-model baseline

- Entities and ordered attributes with definitions and preset/custom entity colors.
- Reusable logical type/domain library.
- Required/optional attributes.
- Primary, alternate, and composite identifiers.
- Association, recursive, identifying, and subtype/supertype relationships.
- N-ary relationships (3+ participants) via `relationship.participants[]`; rendered as a labelled hub node + one leg edge per participant; binary source/target fields remain a projection of participants[0]/[1].
- Crow's Foot cardinality incl. exact-N (`exactly-N` serializes as a string), role names, descriptions, and attribute endpoint mappings.
- Inversion entries per entity (`entity.inversionEntries`) — named non-identifying access paths over attribute sets.
- Selective compare-merge: CompareDialog checkboxes drive `mergeDifferences` (`src/domain/merge.ts`) through one history command.
- Direct relationship drawing and explicit relationship dialog (with "Add participant" for n-ary).
- Multiple diagrams, visibility management, independent positions, notes, subject-area frames, colors, pinning, and saved waypoints.
- Entity-attached comments: `DiagramNote.entityId` anchors a note to an entity — follows moves (delta-shift in `updateEntityPosition(s)`), hides when the entity has no view, deletes on entity delete, and draws a dashed `<noteId>__link` edge (`createNoteLinkEdgeMetadata`).
- Bulk import staging grid (`BulkAttributesDialog`): preview rows are editable (name/type/description/PK/Required/`referencesEntityId`), plus bulk type apply, add/remove rows, and name warnings. `referencesEntityId` creates an identifying relationship to that entity's first identifier attribute inside the same history entry (`applyRelationshipDrafts`).
- Search, minimap, notation legend, pan/zoom/fit, ELK auto-layout, dense-diagram routing fallback.
- Canonical undo/redo, copy/paste, duplicate, keyboard attribute insertion/reorder.
- Attribute ordering: drag-to-reorder grip, Shift-click ↑/↓ jumps to top/bottom, and an "Arrange" select (`sortAttributes` in `src/domain/attributeOrder.ts`) applies one undoable `reorderAttributes` permutation — tiers: identifiers, then relationship FK attributes (`foreignKeyIds`), then rest. `moveAttribute` carries a merge key so rapid Alt+Arrow runs collapse into one history entry. Staged bulk-import rows reorder via ↑/↓ before commit.
- Bulk attribute import: Paste button or Cmd/Ctrl+V opens a column-mapping editable staging grid (TSV/CSV/list) backed by `addAttributes`/`addEntityWithAttributes`.
- Canvas attribute rows are interactive: click selects `{kind:"entity", attributeId}` (inspector scrolls/focuses the field), right-click opens a row context menu, vertical drag reorders via `moveAttribute`, Alt+Arrow moves, Delete deletes. Rows carry `data-attribute-index` attrs; hit-testing uses `elementsFromPoint` (the X6 selection box is `pointer-events:none`). Row presses `preventDefault()` on `pointerdown` — suppressing the compatibility mousedown so the node never drags — and click-selection is applied on `pointerup` instead of `node:click`.
- Logical types are a closed dropdown (`src/components/LogicalTypeSelect.tsx`): `COMMON_LOGICAL_TYPES` + project library types; an unrecognized persisted/imported value is kept as an option so it never renders blank.
- `uiStore.fontScale` (0.9–1.3) drives `--font-scale` on the root and `setCanvasFontScale` in `shapes.ts`; chosen in Settings, persisted to `joinery-font-scale`.
- Shortcuts: `Cmd/Ctrl+F` focuses `#entity-search-input`; `Cmd/Ctrl+=`/`-`/`0` call `zoomIn`/`zoomOut`/`fit` on the canvas ref.
- Canvas resize: `autoResize:false` + `ResizeObserver` AND `window.resize` listener call `graph.resize` (WKWebView misses RO events).
- Naming/documentation standards, model validation, logical-model comparison.
- HTML model report and CSV data dictionary.
- Light/dark themes and keyboard-accessible canvas cells.

## Documents and exports

- Strict Zod-validated `fileType: "joinery"`, `formatVersion: 1` JSON.
- Backward-compatible defaults for pre-release v1 drafts.
- Native atomic New/Open/Save/Save As, file association, single-instance open requests, crash recovery, and full-process quit.
- Deterministic SVG, scaled PNG, content-sized vector PDF, A4/A3 fit, and tiled A4 PDF.
- Export preview excludes editor ports, tools, hit areas, and selection artifacts.
- Mermaid erDiagram export/import (`src/domain/mermaid.ts`); `%% key:` comments round-trip Joinery metadata.
- drawio export/import (`src/domain/drawio.ts`); one page per diagram, ER arrows, `joineryKind` style keys; import is best-effort for ER table shapes and handles compressed pages.
- Model import via toolbar Import button (`src/native/modelIO.ts`); import replaces the project after an unsaved-changes prompt.

## Architecture

- Tauri 2 + Rust native services.
- React + TypeScript + Vite UI.
- AntV X6 native SVG diagram engine.
- ELK.js in a lazily loaded Web Worker.
- Zustand + Immer canonical project state and history.
- Rust `resvg`, `svg2pdf`, and `pdf-writer` output pipeline.
- No Python sidecar and no SQLite requirement for local project documents.

## Quality status

- `npm run check` passes: ESLint, Prettier, TypeScript, Vitest, license policy, and production build.
- 120 frontend/unit/component tests pass.
- 22 Playwright workflows pass, including canvas attribute-row select/context-menu/drag-reorder.
- 9 Rust tests pass; rustfmt, Cargo check, and Clippy pass.
- Native debug and optimized macOS binaries compile and launch.
- Native macOS screenshots reviewed for dark theme, file-open handling, entity colors, and Crow's Foot symbols.
- macOS/Windows CI and draft release workflows exist.

## Source control

- Git repository on branch `main`, pushed to `https://github.com/flyingbearHK/Joinery` (public, MIT).
- Baseline implementation commit: `481aa66`; milestone commit `96a292f feat: logical-modeling depth and mass-editing workflows`.
- Repository-local identity: `FlyingBear <flyingbear@local>` because no global Git identity was configured.
- Generated `node_modules`, `dist`, Rust targets, Playwright output, and local release config are ignored.

## External release blockers

- Human acceptance pass for native dialogs, recovery, exports, and graceful quit.
- Run and visually inspect the Windows build on Windows.
- Supply Apple/Windows/updater signing credentials and verify a signed updater feed.
- Confirm trademark and bundle-identifier ownership before publishing.

## Next active phase

Follow `docs/CLASSIC_MODELER_ROADMAP.md`:

1. Add a separate physical-model layer mapped to logical objects.
2. Add schemas, tables, columns, keys, indexes, checks, and defaults.
3. Add PostgreSQL, SQL Server, MySQL, and Oracle dialect profiles.
4. Add deterministic DDL generation.
5. Add DDL/live-catalog reverse engineering in Rust.
6. Add logical/physical/database compare, selective merge, and migration generation.

## Required resume files

1. `docs/COMPACT_MEMORY.md`
2. `docs/PROJECT_MEMORY.md`
3. `TODO.md`
4. `README.md`
5. `AGENTS.md`
