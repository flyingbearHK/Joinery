# Joinery task list

Priorities are ordered. A checked item has automated coverage or was exercised at the relevant layer. Items requiring external credentials or a second operating system remain explicitly open.

## Release readiness

- [x] Visually inspect the native macOS WebView, entity cards, dark theme, routed edges, and all four Crow's Foot endpoint symbols.
- [x] Build and launch both debug and optimized macOS binaries.
- [ ] Perform a final human acceptance pass through native Open, Save, Save As, recovery, SVG, PNG, PDF, and quit dialogs.
- [ ] Run the configured Windows build and visual smoke test on a Windows host/CI runner.
- [ ] Supply Apple Developer and updater signing secrets, notarize a release, and verify the signed updater feed.
- [ ] Confirm trademark ownership and the final `app.joinery.modeler` bundle identity before public distribution.

## Classic logical-modeler baseline

- [x] Canonical command-based undo/redo across canvas and inspector edits.
- [x] Copy, paste, and duplicate entities with new stable IDs.
- [x] Direct port-to-port and explicit form-based relationship creation.
- [x] Relationship reconnection validation and duplicate prevention.
- [x] Recursive associations and subtype/supertype relationships.
- [x] Relationship role names, identifying semantics, and Crow's Foot cardinality.
- [x] Attribute-to-attribute endpoint mapping.
- [x] Diagram rename, delete, duplicate, and entity visibility management.
- [x] Multiple independent diagrams over one canonical model.
- [x] Pin/unpin entities and preserve pinned positions during automatic layout.
- [x] Primary, alternate, and composite identifiers.
- [x] Attribute reordering and keyboard-first row insertion.
- [x] Editable project, entity, attribute, relationship, and diagram definitions.
- [x] Reusable custom logical type/domain library.
- [x] Model naming standards and required-definition validation options.
- [x] Per-entity preset/custom colors, notes, subject-area frames, and a notation legend.
- [x] Diagram-specific relationship waypoints with reset support.
- [x] Model validation panel with navigation to issues.
- [x] Logical model comparison against another `.joinery` document.
- [x] Printable HTML model report and CSV data dictionary.
- [x] Light and dark themes.
- [x] Accessible labels, focus targets, and keyboard traversal for canvas objects.
- [x] Minimap, search, pan, zoom, fit, collapse, and auto-arrange controls.
- [x] Confirmation dialogs and non-blocking status notifications.

## Documents and export

- [x] Strict, versioned `.joinery` serializer with runtime validation and migration entry point.
- [x] Native New/Open/Save/Save As with atomic replacement and file-size limits.
- [x] `.joinery` desktop file association, single-instance handling, and open-with support.
- [x] Autosave recovery without using browser storage as the native document source of truth.
- [x] Deterministic, content-bounded SVG export without editor artifacts.
- [x] PNG export with scale and background controls.
- [x] One-page vector PDF sized to content.
- [x] A4/A3 portrait and landscape PDF fitting.
- [x] Multi-page tiled A4 PDF output for large diagrams.
- [x] Live export preview, progress state, and error handling.

## Performance and quality

- [x] Move ELK layout into a lazily loaded Web Worker.
- [x] Add a deterministic 100-entity/200-relationship performance fixture.
- [x] Exercise render, pan, and automatic layout against the 100-entity fixture in browser automation.
- [x] Add domain/store tests for history, identifiers, cascading deletes, diagrams, and relationship validation.
- [x] Add component tests for entity and relationship inspectors.
- [x] Add a Playwright browser end-to-end harness.
- [x] Add native command tests for atomic document I/O and SVG/PNG/PDF output.
- [x] Configure ESLint, Prettier, type checking, unit tests, and license checks.
- [x] Add macOS and Windows CI build jobs.
- [x] Audit dependency licenses and include `THIRD_PARTY_NOTICES.md`.
- [x] Configure a hardened production CSP and file associations.
- [x] Configure draft GitHub releases, universal macOS builds, Windows builds, signing hooks, notarization hooks, and updater artifacts.
- [x] Replace the provisional bundle identifier with `app.joinery.modeler`.

## Next product phase — classic physical-model parity

The latest product target expands beyond the original logical-only MVP. The detailed sequence is in `docs/CLASSIC_MODELER_ROADMAP.md`.

- [ ] Add a separate physical-model layer mapped to logical objects.
- [ ] Add schemas, tables, columns, PK/FK/UK constraints, indexes, checks, and defaults.
- [ ] Add PostgreSQL, SQL Server, MySQL, and Oracle datatype/dialect profiles.
- [ ] Add deterministic forward-engineered DDL.
- [ ] Add DDL and live-catalog reverse engineering through Rust.
- [ ] Add logical/physical/database compare and selective merge.
- [ ] Add migration/alter-script generation with dependency ordering.
- [ ] Keep multi-user/cloud collaboration out until it is separately approved.

## Completed foundation

- [x] Tauri 2 + React + TypeScript + Vite desktop foundation.
- [x] Native SVG X6 projection separated from canonical model state.
- [x] Rust application services with no Python sidecar.
- [x] Branded icon assets, BY FLYINGBEAR/version credit, and macOS-first desktop layout.
- [x] Native recovery-aware application exit and Cmd/Ctrl+Q.
- [x] X6 compatibility fixture exercised by native raster and vector renderers.
