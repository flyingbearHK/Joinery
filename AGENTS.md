# Joinery agent guide

This file is the entry point for future coding sessions.

## Required context

Before making changes, read these files:

1. `docs/COMPACT_MEMORY.md` — concise current-state handoff.
2. `docs/PROJECT_MEMORY.md` — durable product and architecture decisions.
3. `TODO.md` — prioritized work and current milestone status.
4. `README.md` — supported commands and current user-facing behavior.

After meaningful work:

- Update `TODO.md` by moving completed work and recording newly discovered tasks.
- Update `docs/PROJECT_MEMORY.md` only when a durable decision, constraint, blocker, or architectural fact changes.
- Keep `docs/COMPACT_MEMORY.md` short and current enough to resume after context compaction.
- Run `npm test` and `npm run build`.
- For Rust changes, also run rustfmt, `cargo check`, and Clippy against `src-tauri/Cargo.toml`.
- Do not mark native Tauri work verified unless it was compiled with Rust and exercised in the desktop shell.

## Product invariants

- Joinery is an offline, standalone logical ER modeling application targeting the depth of classic desktop data-modeling tools.
- It is not yet a physical database designer and does not generate or import SQL. Add any future physical model as a separate mapped layer.
- The model is database-vendor-neutral and uses Crow's Foot cardinality.
- One logical model can be presented by multiple diagrams. Model data and diagram layout must remain separate.
- Project documents use a strict, versioned `.joinery` format; browser local storage is only a recovery fallback during web development.
- macOS is the first target, but shared code must remain Windows-compatible.
- Export quality matters: SVG is the canonical render format; PNG and vector PDF derive from it.

## Architecture rules

- The domain model in `src/domain/` is canonical. Do not make the X6 graph the source of truth.
- X6 cells are projections of entities, relationships, and the active diagram's view state.
- Use stable IDs for all model objects and relationship endpoints.
- A relationship owns its kind, role names, cardinality at both ends, and optional endpoint attributes. Do not infer domain semantics from visual markers or X6 port IDs.
- Undo/redo records canonical project snapshots. Every persistent mutation must go through a history-aware store command.
- `attribute.isIdentifier` is a derived compatibility flag; `entity.identifiers` is authoritative.
- Keep database-specific concepts out of the logical core.
- Persist documents atomically and add explicit migrations for every future format version.
- Validate document structure and cross-references before loading it into the canonical store.
- Prefer native SVG X6 shapes over `foreignObject`/HTML nodes so vector export remains deterministic.
- Keep editor-only ports, hit areas, and selection controls out of exported SVG.

## Commands

```bash
npm install
npm run dev          # browser UI only
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:e2e
npm run licenses
npm run tauri dev    # requires Rust and Tauri prerequisites
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```
