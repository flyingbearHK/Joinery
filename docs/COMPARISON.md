# Logical ERD comparison — Joinery vs erwin vs SqlDBM

Captured: 2026-10-01. Scope: **logical ERD modeling only** — physical modeling,
DDL generation, and reverse engineering are excluded. Scores are 0–5.

## Feature table

| Feature                                               | Joinery                                                                                                                       | erwin Data Modeler                                                                               | SqlDBM                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Entity & attribute editing (descriptions, ordering)   | **5** — inspector editing, drag reorder, Arrange presets (keys/FKs first, A–Z), jump-to-top/bottom                            | **5** — bulk attribute grid, deep property editors                                               | **5** — polished table/column editing, view modes   |
| Keys & identifiers                                    | **5** — primary/alternate/composite identifiers + inversion entries                                                           | **5** — PK/AK/inversion entries, key groups                                                      | **4** — PK/FK/AK, constraint auto-detection         |
| Notation support                                      | **2** — Crow's Foot only (deliberate choice)                                                                                  | **5** — IDEF1X + IE + DM, per-model notation                                                     | **4** — Crow's Foot + IDEF1X toggle                 |
| Relationship semantics                                | **4** — identifying, recursive, subtype, n-ary (hub + legs), exact-N cardinality                                              | **5** — identifying/non-identifying, logical M:N, complete/incomplete subtypes, n-ary, recursive | **4** — M:N Chen-diamond hybrid, subtypes; no n-ary |
| Attribute-level endpoints                             | **5** — explicit attribute-to-attribute mapping                                                                               | **5** — key migration / rolenames                                                                | **3** — mostly FK-column driven                     |
| Multiple diagrams & subject areas                     | **4** — independent diagrams, per-diagram visibility/positions, subject-area frames                                           | **5** — first-class named subject areas                                                          | **5** — subject areas, per-diagram filters, groups  |
| Reusable domains / logical types                      | **4** — type library (base type, format, description)                                                                         | **5** — domain hierarchies, UDDs with rules                                                      | **4** — column templates                            |
| Bulk attribute entry (paste from Excel)               | **5** — direct paste into editable staging grid: fix names/types/PK/required/order, reference picks auto-create relationships | **3** — bulk editor grid; no direct Excel paste                                                  | **2** — Excel import covers documentation only      |
| Editing ergonomics (undo/redo, copy/paste, duplicate) | **5** — full history, merged-undo reorder, entity copy via clipboard marker, keyboard ops                                     | **4** — capable, dated interaction model                                                         | **4** — good UX, drag-to-copy columns               |
| Diagram annotations / review comments                 | **5** — entity-attached comments that follow moves/layout + free notes                                                        | **3** — diagram text objects only; no comment lifecycle                                          | **4** — object comments tied to cloud collaboration |
| Validation & naming standards                         | **4** — validation panel, naming + required-description policies                                                              | **5** — deep rules engine, standards enforcement                                                 | **3** — lighter checks                              |
| Auto-layout & navigation                              | **4** — ELK layout, minimap, search, fit                                                                                      | **4** — auto-layout, display levels                                                              | **4** — auto-arrange, table view                    |
| Import/export interop                                 | **4** — Mermaid `.mmd` + drawio `.drawio` round-trip, `.joinery`                                                              | **5** — erwin XML, XMI, metadata bridges                                                         | **4** — DDL-driven, Excel docs, dbt                 |
| Compare / merge                                       | **4** — comparison view + selective checkbox merge with applied/skipped report                                                | **5** — Complete Compare with selective merge                                                    | **4** — compare + alter scripts                     |
| Reporting / documentation                             | **3** — HTML report + CSV dictionary                                                                                          | **5** — report designer, glossary                                                                | **4** — published DBDocs, Excel round-trip          |
| Collaboration / multiuser                             | **1** — single-user by design                                                                                                 | **5** — Model Mart repository                                                                    | **5** — cloud-native collaboration                  |
| Platform & deployment                                 | **4** — offline desktop, single portable file                                                                                 | **2** — Windows-only heavyweight install                                                         | **3** — browser-only subscription                   |

## Totals

| Tool    | Score                                                 |
| ------- | ----------------------------------------------------- |
| erwin   | **76/85** — depth benchmark                           |
| Joinery | **68/85** — rechecked after ordering/staging/comments |
| SqlDBM  | **66/85** — logical view over a DB-bound model        |

> Note: denominator is now 85 (17 features — "Diagram annotations" added).
> Recomputing the prior columns surfaced two arithmetic slips in the
> original table: erwin summed to 73 (not 72) and SqlDBM to 62 (not 63);
> corrected here.

## Where Joinery wins

- Bulk attribute paste — now an editable staging grid (fix names, types, PK/
  Required, row order, and entity references that auto-create identifying
  relationships, all in one undoable commit). Neither competitor has direct
  Excel-to-structure paste at all.
- Attribute ordering — drag-to-reorder, jump-to-top/bottom, and one-click
  Arrange presets that float identifiers and FK attributes to the top;
  neither competitor offers derived-FK ordering.
- Entity-attached diagram comments that follow moves and auto-layout —
  purpose-built for review meetings; erwin only has static text objects.
- Pure vendor-neutral logical model — SqlDBM's logical view still sits on a
  dialect-bound physical model; erwin's logical is one half of a
  logical+physical pair.
- Mermaid/drawio round-trip interop.

## Gap list and disposition

| #   | Gap                                      | Disposition                                                             |
| --- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 1   | IDEF1X notation                          | **Won't do** — Crow's Foot is the deliberate single notation            |
| 2   | n-ary relationships                      | **Done** — `participants[]` on associations, hub node + leg edges       |
| 3   | exact-N cardinality ("exactly 3")        | **Done** — `exactly-N` cardinality + `(N)` count labels on edges        |
| 4   | complete/incomplete subtype markers      | **Skipped** — inheritance exists without IDEF1X cluster semantics       |
| 5   | merge in model compare                   | **Done** — selective apply of comparison diffs, one history entry       |
| 6   | inversion entries (non-key access paths) | **Done** — `entity.inversionEntries`, inspector UI, compare/merge-aware |

## Recheck notes (2026-10-01, #2 — staging grid, comments, ordering)

- Entity & attribute editing 4→5: drag-to-reorder grip, Shift-click
  jump-to-top/bottom, merged-undo Alt+Arrow runs, and Arrange presets
  (identifiers → FK attributes → rest, or A–Z) via one undoable
  `reorderAttributes` permutation.
- New row — Diagram annotations / review comments: Joinery 5
  (entity-attached comments follow moves/layout, dashed connector,
  inspector CRUD), erwin 3, SqlDBM 4.
- Bulk attribute entry stays 5 with a stronger justification: staging rows
  are editable pre-commit and reference picks create identifying
  relationships in the same history entry.
- Total 62/80→68/85. Joinery now leads SqlDBM on this rubric; remaining
  erwin gaps are reporting depth, collaboration, and notation breadth.
