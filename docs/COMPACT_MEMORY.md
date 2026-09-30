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
- Crow's Foot cardinality, role names, descriptions, and attribute endpoint mappings.
- Direct relationship drawing and explicit relationship dialog.
- Multiple diagrams, visibility management, independent positions, notes, subject-area frames, colors, pinning, and saved waypoints.
- Search, minimap, notation legend, pan/zoom/fit, ELK auto-layout, dense-diagram routing fallback.
- Canonical undo/redo, copy/paste, duplicate, keyboard attribute insertion/reorder.
- Naming/documentation standards, model validation, logical-model comparison.
- HTML model report and CSV data dictionary.
- Light/dark themes and keyboard-accessible canvas cells.

## Documents and exports

- Strict Zod-validated `fileType: "joinery"`, `formatVersion: 1` JSON.
- Backward-compatible defaults for pre-release v1 drafts.
- Native atomic New/Open/Save/Save As, file association, single-instance open requests, crash recovery, and full-process quit.
- Deterministic SVG, scaled PNG, content-sized vector PDF, A4/A3 fit, and tiled A4 PDF.
- Export preview excludes editor ports, tools, hit areas, and selection artifacts.

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
- 38 frontend/unit/component tests pass.
- 12 Playwright workflows pass, including the 100-entity/200-relationship fixture.
- 9 Rust tests pass; rustfmt, Cargo check, and Clippy pass.
- Native debug and optimized macOS binaries compile and launch.
- Native macOS screenshots reviewed for dark theme, file-open handling, entity colors, and Crow's Foot symbols.
- macOS/Windows CI and draft release workflows exist.

## Source control

- Git repository initialized on branch `main`.
- Baseline implementation commit: `481aa66 feat: establish Joinery logical modeler baseline`.
- Repository-local identity: `FlyingBear <flyingbear@local>` because no global Git identity was configured.
- No remote is configured.
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
