# Joinery project memory

Last updated: 2026-10-01

This document is durable project memory for future development sessions. Keep decisions concise and update it whenever a product invariant or architectural decision changes.

## Product identity

- **Name:** Joinery
- **Credit:** BY FLYINGBEAR
- **Tagline:** Fit your data together.
- The top-left brand block shows `BY FLYINGBEAR` and the package-derived application version.
- **Purpose:** A fast, standalone replacement for creating and maintaining logical ER diagrams in general-purpose drawing tools.
- **Document extension:** `.joinery`
- **Application identifier:** `app.joinery.modeler`; confirm trademark and identifier ownership before public distribution.

## Product baseline

The requested quality bar is the logical-modeling capability of classic ERwin/ER/Studio-era desktop tools, with a more approachable interface. Joinery must feel like a modeler, not a drawing program.

Confirmed constraints remain:

- Desktop, offline, and single-user; no collaboration server.
- macOS first, with Windows-compatible shared code and CI.
- Vendor-neutral logical modeling is the current scope.
- The original MVP excluded SQL/physical design, but the current product target now requires classic modeler parity. Physical models, DDL, reverse engineering, compare/merge, and migration generation are the next phase and must remain a separate layer mapped to the logical core.
- Crow's Foot notation.
- Typical diagrams contain 10–50 entities; the supported target is 100 entities and roughly 200 relationships.
- One canonical model supports multiple independent diagrams/views.

## Implemented modeling depth

- Entities and ordered logical attributes with descriptions and reusable logical types.
- Required/optional attributes.
- Primary, alternate, and composite identifiers. The legacy attribute-level `isIdentifier` property is retained as a derived compatibility flag.
- Association and subtype/supertype relationships.
- Recursive associations.
- Independent endpoint cardinality, role names, descriptions, and identifying semantics.
- Optional relationship mapping to concrete attributes at either endpoint.
- Multiple diagrams, per-diagram visibility, collapse state, pinned positions, notes, subject-area frames, and relationship waypoints.
- Entity colors with preset palettes and custom color selection, plus a Crow's Foot legend.
- Naming-convention and required-definition standards.
- Model validation with navigable errors/warnings/suggestions.
- Name-based model comparison.
- HTML model reports and CSV data dictionaries.

## Export decisions

- SVG is the canonical export representation.
- Export clones the active SVG graph, crops it to model bounds, removes ports/hit areas/tools, and normalizes definition IDs for deterministic output.
- PNG derives from SVG through Rust `resvg` at 1×, 2×, or 3×.
- PDF uses `svg2pdf` and remains vector-based.
- PDF supports content-sized pages, A4/A3 portrait and landscape fitting, and tiled A4 landscape pages.
- White and transparent diagram backgrounds are supported.

## Technology decisions

- Tauri 2 desktop shell and Rust native services; no Python sidecar.
- React + TypeScript + Vite for UI.
- AntV X6 for native SVG diagram rendering and interaction.
- ELK.js runs through a lazily loaded Web Worker for layered layout.
- Dense diagrams above 70 entities use X6 orthogonal routing instead of obstacle-searching Manhattan routing to preserve responsiveness.
- Zustand + Immer own canonical state and command history.
- Zod validates persisted documents before they enter the store.
- A token-based CSS system is used instead of a component framework.
- SQLite is unnecessary for the current standalone document model.

## Domain invariants

- The TypeScript domain model is canonical; X6 is only a visual projection.
- Stable IDs identify every entity, attribute, identifier, relationship, diagram, note, and subject area.
- A relationship owns its semantics. Port IDs are only an interaction encoding.
- Diagram state never duplicates entity or relationship definitions.
- Model edits propagate to every diagram; positions, visibility, routes, notes, and frames are diagram-specific.
- Only one primary identifier is allowed per entity; any number of alternate identifiers may exist.
- Recursive associations are valid; recursive inheritance is rejected.
- A project always contains at least one diagram.

## Persistence and lifecycle

- Documents are strict versioned JSON with `fileType: "joinery"` and `formatVersion: 1`.
- Missing fields from pre-release v1 drafts receive safe defaults before semantic validation.
- Native writes create and flush a temporary file beside the destination before atomic replacement.
- Unsaved recovery snapshots live in Tauri's application-data directory. Browser localStorage is only a development recovery fallback.
- Native close writes recovery data when needed and exits the complete process.
- `.joinery` files are registered with the desktop bundle. Initial and second-instance open requests are queued and delivered to the frontend.

## UX behavior

- Three-panel workspace: model navigator, infinite canvas, property inspector.
- Single-click in the navigator selects without moving the viewport; double-click centers an entity.
- Relationships can be selected through a broad invisible line target or the Relationships list.
- Selecting a relationship reveals editable routing handles without an unexplained rectangular selection box.
- Direct attribute-port drawing and an explicit relationship dialog are both supported.
- Undo/redo operates on canonical model snapshots and merges rapid edits to the same field.
- Copy/paste and duplicate generate fresh entity, attribute, and identifier IDs.
- Light and dark themes are persistent.

## Build, testing, and distribution

- Frontend checks include ESLint, Prettier, TypeScript, Vitest, dependency-license policy, and production build.
- Playwright covers common workflows and a 100-entity/200-relationship fixture.
- Rust tests cover atomic document I/O, SVG compatibility, PNG output, content-sized PDF, standard pages, and tiled PDF.
- Native debug and optimized macOS binaries have compiled and launched successfully.
- Native macOS screenshots have been reviewed for the dark theme, entity cards, all Crow's Foot marker families, and a `.joinery` file opened from a process argument.
- CI defines macOS and Windows builds. Windows still requires execution on a Windows runner and a human visual pass.
- Draft release automation includes universal macOS and Windows artifacts, signing/notarization environment hooks, and signed updater configuration. Real credentials are intentionally absent.
- See `docs/DISTRIBUTION.md` and `THIRD_PARTY_NOTICES.md`.

## Source control

- Git is initialized on branch `main`.
- Baseline commit: `481aa66 feat: establish Joinery logical modeler baseline`.
- Repository-local identity is `FlyingBear <flyingbear@local>` because no global identity was configured; replace it before publishing if desired.
- No remote is configured.
- Generated frontend, Rust, test, and release-secret artifacts are ignored.

## Known external verification items

- Human-test native Open/Save/Save As, recovery prompts, export dialogs/files, and graceful quit.
- Run and inspect the Windows application on Windows.
- Supply Apple, Windows, and updater signing credentials and verify a signed release/update feed.
- Confirm product trademark and final identifier ownership.

## Physical-model expansion rule

Physical modeling is now the active next product phase. Add a separate physical model mapped to logical entities and attributes. Do not overload logical types, identifiers, or relationships with dialect-specific columns, indexes, constraints, or storage settings. Follow `docs/CLASSIC_MODELER_ROADMAP.md`.
