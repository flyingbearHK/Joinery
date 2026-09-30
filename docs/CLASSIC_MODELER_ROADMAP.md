# Classic modeler parity roadmap

The long-term baseline is the practical capability of mature ERwin/ER/Studio-era desktop tools, delivered with Joinery's simpler local-first UX. This is a product roadmap, not a claim that every vendor-specific feature is already complete.

## Stage 1 — logical modeling foundation (implemented)

- Entities, attributes, definitions, reusable logical types/domains
- Primary, alternate, and composite identifiers
- Association, recursive, identifying, and subtype/supertype relationships
- Role names, Crow's Foot cardinality, and attribute endpoint mappings
- Multiple subject-area diagrams with independent layouts and routes
- Notes, frames, colors, pinning, layout, minimap, and validation
- Naming/documentation standards
- Undo/redo, compare, reports, and data dictionary
- Versioned local documents, crash recovery, and vector/raster export

## Stage 2 — physical model layer (next)

Create an explicit physical layer mapped to logical objects:

- Schemas, tables, columns, primary/foreign/unique keys
- Indexes, check constraints, defaults, generated columns, and comments
- Mapping from logical entities/attributes/relationships to physical artifacts
- Multiple physical models from one logical model
- Dialect profiles beginning with PostgreSQL, SQL Server, MySQL, and Oracle
- Naming transformations and datatype/domain mappings
- Forward-engineered DDL with deterministic output

Logical objects remain vendor-neutral. Physical details must never be stored directly on logical entities or attributes.

## Stage 3 — reverse engineering and synchronization

- Parse vendor DDL into physical models
- Read catalogs from live databases through Rust drivers
- Infer logical models from physical schemas
- Compare model-to-model, model-to-database, and database-to-database
- Selective merge with conflict resolution
- Migration/alter-script generation and dependency ordering

## Stage 4 — enterprise modeling depth

- Model libraries and reusable standard domains
- Naming-standard templates and abbreviation dictionaries
- Model-level security metadata, stewardship, and classification
- More report templates and configurable documentation
- Larger-model navigation, filters, and impact analysis
- Optional repository/collaboration layer only if explicitly approved

## Quality gates for every stage

- Canonical domain types and explicit migrations
- Undo/redo coverage for every mutation
- Cross-reference and semantic validation before save or generation
- Deterministic fixtures and round-trip tests
- macOS and Windows CI builds
- Native interaction smoke tests
- No silent loss of unsupported vendor metadata
