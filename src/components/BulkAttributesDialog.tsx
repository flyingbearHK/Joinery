import { useMemo, useState } from "react";
import { ClipboardPaste, Plus, Trash2, X } from "lucide-react";
import {
  ATTRIBUTE_COLUMN_ROLE_OPTIONS,
  buildAttributeDrafts,
  detectHeaderRow,
  parseAttributeSourceText,
  suggestColumnRoles,
  type AttributeColumnRole,
  type AttributeImportDraft,
} from "../domain/attributeImport";
import { COMMON_LOGICAL_TYPES, type EntityId } from "../domain/model";
import { LogicalTypeSelect } from "./LogicalTypeSelect";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";

const NEW_ENTITY = "__new_entity__";

interface StagedRow extends AttributeImportDraft {
  included: boolean;
}

const blankRow = (): StagedRow => ({
  name: "",
  logicalType: "Text",
  description: "",
  isRequired: false,
  isIdentifier: false,
  included: true,
});

/**
 * Store-driven dialog for bulk attribute entry. Paste rows copied from a
 * spreadsheet (tab-separated), CSV text, or a plain list of names, adjust
 * the detected column mapping, then commit as one undoable command.
 */
export function BulkAttributesDialog() {
  const request = useUiStore((state) => state.bulkImport);
  if (!request) return null;
  return (
    <BulkAttributesDialogInner
      key={request.requestId}
      entityId={request.entityId}
      initialText={request.initialText}
    />
  );
}

interface BulkAttributesDialogInnerProps {
  entityId: EntityId | null;
  initialText: string;
}

function BulkAttributesDialogInner({
  entityId,
  initialText,
}: BulkAttributesDialogInnerProps) {
  const entities = useProjectStore((state) => state.project.model.entities);
  const logicalTypes = useProjectStore((state) => state.project.model.logicalTypes);
  const addAttributes = useProjectStore((state) => state.addAttributes);
  const addEntityWithAttributes = useProjectStore(
    (state) => state.addEntityWithAttributes,
  );
  const closeBulkImport = useUiStore((state) => state.closeBulkImport);

  const entityList = useMemo(() => Object.values(entities), [entities]);
  const knownTypes = useMemo(
    () => [
      ...COMMON_LOGICAL_TYPES,
      ...Object.values(logicalTypes).map((logicalType) => logicalType.name),
    ],
    [logicalTypes],
  );

  const [targetKey, setTargetKey] = useState<string>(
    entityId && entities[entityId] ? entityId : NEW_ENTITY,
  );
  const [newEntityName, setNewEntityName] = useState("");
  const [text, setText] = useState(initialText);
  const [headerOverride, setHeaderOverride] = useState<boolean | null>(null);
  const [manualRoles, setManualRoles] = useState<AttributeColumnRole[] | null>(null);
  const [showSource, setShowSource] = useState(true);
  const [staging, setStaging] = useState<{ key: string; rows: StagedRow[] }>({
    key: "",
    rows: [],
  });
  const [bulkType, setBulkType] = useState("");

  const rows = useMemo(() => parseAttributeSourceText(text), [text]);
  const detectedHeader = useMemo(() => detectHeaderRow(rows), [rows]);
  const hasHeader = headerOverride ?? detectedHeader;
  const suggestedRoles = useMemo(
    () => suggestColumnRoles(rows, hasHeader, knownTypes),
    [rows, hasHeader, knownTypes],
  );
  const roles =
    manualRoles && manualRoles.length === suggestedRoles.length
      ? manualRoles
      : suggestedRoles;
  const drafts = useMemo(
    () => buildAttributeDrafts(rows, roles, hasHeader, knownTypes),
    [rows, roles, hasHeader, knownTypes],
  );

  // The staging grid is derived from the parsed rows but independently
  // editable; edits reset whenever the parse signature changes (new text,
  // header toggle, or column re-mapping).
  const stageKey = `${hasHeader ? "header:" : ""}${roles.join(",")}:${text}`;
  const stagedRows: StagedRow[] =
    staging.key === stageKey
      ? staging.rows
      : drafts.map((draft) => ({ ...draft, included: true }));

  const commitStaging = (rows: StagedRow[]) => setStaging({ key: stageKey, rows });
  const patchRow = (index: number, patch: Partial<StagedRow>) =>
    commitStaging(
      stagedRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  const moveStagedRow = (index: number, targetIndex: number) => {
    const bounded = Math.max(0, Math.min(targetIndex, stagedRows.length - 1));
    if (bounded === index) return;
    const next = stagedRows.slice();
    const [row] = next.splice(index, 1);
    next.splice(bounded, 0, row);
    commitStaging(next);
  };

  const creatingEntity = targetKey === NEW_ENTITY;
  const targetEntity = creatingEntity ? null : (entities[targetKey] ?? null);
  const existingNames = useMemo(
    () =>
      new Set(
        (targetEntity?.attributes ?? []).map((attribute) =>
          attribute.name.trim().toLowerCase(),
        ),
      ),
    [targetEntity],
  );
  const stagedNames = useMemo(() => {
    const counts = new Map<string, number>();
    stagedRows.forEach((row) => {
      if (!row.included) return;
      const key = row.name.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [stagedRows]);
  const rowWarning = (row: StagedRow): string | null => {
    const name = row.name.trim().toLowerCase();
    if (!name) return "Empty name — skipped on import";
    if ((stagedNames.get(name) ?? 0) > 1) return "Duplicate name in this import";
    if (existingNames.has(name)) return "Name already exists on the entity";
    return null;
  };

  const included = stagedRows.filter(
    (row) => row.included && row.name.trim().length > 0,
  );
  const warningCount = stagedRows.filter(
    (row) => row.included && rowWarning(row),
  ).length;
  const canCommit = included.length > 0;

  function updateColumnRole(columnIndex: number, role: AttributeColumnRole) {
    const next = roles.slice();
    if (role !== "ignore") {
      next.forEach((current, index) => {
        if (current === role && index !== columnIndex) next[index] = "ignore";
      });
    }
    next[columnIndex] = role;
    setManualRoles(next);
  }

  function commit() {
    if (!canCommit) return;
    if (creatingEntity) {
      addEntityWithAttributes(newEntityName, included);
      closeBulkImport();
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>("[data-attribute-name]")?.focus();
      });
      return;
    }
    const attributeIds = addAttributes(targetKey, included);
    closeBulkImport();
    const firstId = attributeIds[0];
    if (firstId) {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLInputElement>(
            `[data-attribute-name="${CSS.escape(firstId)}"]`,
          )
          ?.focus();
      });
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeBulkImport();
      }}
    >
      <section
        className="bulk-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            closeBulkImport();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.stopPropagation();
            commit();
          }
        }}
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Bulk import</span>
            <h2 id="bulk-import-title">Paste attributes</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close bulk import"
            onClick={closeBulkImport}
          >
            <X size={15} />
          </button>
        </header>

        <div className="export-dialog-body bulk-import-body">
          <div className="bulk-import-target">
            <label className="field-label" htmlFor="bulk-import-target">
              Add attributes to
            </label>
            <select
              id="bulk-import-target"
              className="select-field"
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
            >
              {entityList.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name || "Untitled entity"}
                </option>
              ))}
              <option value={NEW_ENTITY}>New entity…</option>
            </select>
            {creatingEntity && (
              <input
                className="text-field"
                value={newEntityName}
                onChange={(event) => setNewEntityName(event.target.value)}
                placeholder="Entity name"
                aria-label="New entity name"
              />
            )}
          </div>

          <div className="bulk-import-source">
            <div className="bulk-import-source-heading">
              <label className="field-label" htmlFor="bulk-import-rows">
                Rows — one attribute per line
              </label>
              {rows.length > 0 && (
                <button
                  type="button"
                  className="text-action"
                  onClick={() => setShowSource((current) => !current)}
                >
                  {showSource ? "Hide source text" : "Show source text"}
                </button>
              )}
            </div>
            {showSource && (
              <textarea
                id="bulk-import-rows"
                className="text-field textarea bulk-import-textarea"
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  "Paste from Excel or type a list. Examples:\ncustomer id\tIdentifier\tStable customer key\nname\tText\tCustomer display name\n\nor simply:\ncustomer id\nname\nemail"
                }
                rows={6}
              />
            )}
            {showSource && stagedRows.length > 0 && (
              <p className="bulk-import-note">
                Editing the source text reparses the table and clears edits made in the
                grid below.
              </p>
            )}
          </div>

          {rows.length === 0 && stagedRows.length === 0 && (
            <div className="dialog-empty-state bulk-import-empty">
              <ClipboardPaste size={20} />
              <strong>Nothing to import yet</strong>
              <span>
                Paste tab-separated rows from a spreadsheet or type one attribute name
                per line.
              </span>
              <button
                type="button"
                className="small-button"
                onClick={() => commitStaging([blankRow()])}
              >
                <Plus size={13} /> Add rows manually
              </button>
            </div>
          )}

          {stagedRows.length > 0 && (
            <>
              {rows.length > 0 && (
                <>
                  <label className="check-row bulk-import-header-toggle">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(event) => {
                        setHeaderOverride(event.target.checked ? true : false);
                        setManualRoles(null);
                      }}
                    />
                    <span>
                      <strong>First row is a header</strong>
                      Column names such as name, type, or description.
                    </span>
                  </label>

                  {roles.length > 1 && (
                    <div className="bulk-import-columns">
                      {roles.map((role, index) => (
                        <label key={index} className="bulk-import-column">
                          <span>
                            Column {index + 1}
                            <em>{sampleCell(rows, hasHeader, index)}</em>
                          </span>
                          <select
                            className="compact-select"
                            value={role}
                            aria-label={`Column ${index + 1} role`}
                            onChange={(event) =>
                              updateColumnRole(
                                index,
                                event.target.value as AttributeColumnRole,
                              )
                            }
                          >
                            {ATTRIBUTE_COLUMN_ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="bulk-import-toolbar">
                <button
                  type="button"
                  className="small-button"
                  onClick={() => commitStaging([...stagedRows, blankRow()])}
                >
                  <Plus size={13} /> Add row
                </button>
                <div className="bulk-import-apply-all">
                  <label htmlFor="bulk-import-all-type">Type for all</label>
                  <select
                    id="bulk-import-all-type"
                    className="compact-select"
                    value={bulkType}
                    onChange={(event) => setBulkType(event.target.value)}
                  >
                    <option value="">Choose…</option>
                    {knownTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-action"
                    disabled={!bulkType}
                    onClick={() =>
                      commitStaging(
                        stagedRows.map((row) =>
                          row.included ? { ...row, logicalType: bulkType } : row,
                        ),
                      )
                    }
                  >
                    Apply
                  </button>
                </div>
                {warningCount > 0 && (
                  <span className="bulk-import-warning-count">
                    {warningCount} warning{warningCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="bulk-import-preview" aria-label="Import staging">
                <table>
                  <thead>
                    <tr>
                      <th aria-label="Include">
                        <input
                          type="checkbox"
                          aria-label="Include all rows"
                          checked={stagedRows.every((row) => row.included)}
                          onChange={(event) =>
                            commitStaging(
                              stagedRows.map((row) => ({
                                ...row,
                                included: event.target.checked,
                              })),
                            )
                          }
                        />
                      </th>
                      <th aria-label="Order" />
                      <th>Name</th>
                      <th>Type</th>
                      <th title="Part of the primary identifier">PK</th>
                      <th title="Required">Req</th>
                      <th title="Create a relationship to this entity's identifier">
                        References
                      </th>
                      <th>Description</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {stagedRows.map((row, index) => {
                      const warning = row.included ? rowWarning(row) : null;
                      return (
                        <tr
                          key={index}
                          className={[
                            row.included ? "" : "excluded",
                            warning ? "warning" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={warning ?? undefined}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={row.included}
                              aria-label={`Include ${row.name || `row ${index + 1}`}`}
                              onChange={(event) =>
                                patchRow(index, { included: event.target.checked })
                              }
                            />
                          </td>
                          <td className="bulk-order-cell">
                            <button
                              type="button"
                              title={`Move ${row.name || `row ${index + 1}`} up — ⇧-click moves to top`}
                              aria-label={`Move ${row.name || `row ${index + 1}`} up`}
                              disabled={index === 0}
                              onClick={(event) =>
                                moveStagedRow(
                                  index,
                                  event.shiftKey || event.metaKey ? 0 : index - 1,
                                )
                              }
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title={`Move ${row.name || `row ${index + 1}`} down — ⇧-click moves to bottom`}
                              aria-label={`Move ${row.name || `row ${index + 1}`} down`}
                              disabled={index === stagedRows.length - 1}
                              onClick={(event) =>
                                moveStagedRow(
                                  index,
                                  event.shiftKey || event.metaKey
                                    ? stagedRows.length - 1
                                    : index + 1,
                                )
                              }
                            >
                              ↓
                            </button>
                          </td>
                          <td>
                            <input
                              className="bulk-cell-input"
                              value={row.name}
                              aria-label={`Name for row ${index + 1}`}
                              placeholder="Attribute name"
                              onChange={(event) =>
                                patchRow(index, { name: event.target.value })
                              }
                            />
                          </td>
                          <td>
                            <LogicalTypeSelect
                              className="bulk-cell-input bulk-type-select"
                              value={row.logicalType}
                              ariaLabel={`Type for ${row.name || `row ${index + 1}`}`}
                              onChange={(value) =>
                                patchRow(index, { logicalType: value })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={row.isIdentifier}
                              aria-label={`Primary key for ${row.name || `row ${index + 1}`}`}
                              onChange={(event) =>
                                patchRow(index, {
                                  isIdentifier: event.target.checked,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={row.isRequired}
                              aria-label={`Required for ${row.name || `row ${index + 1}`}`}
                              onChange={(event) =>
                                patchRow(index, {
                                  isRequired: event.target.checked,
                                })
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="bulk-cell-select"
                              value={row.referencesEntityId ?? ""}
                              aria-label={`References for ${row.name || `row ${index + 1}`}`}
                              onChange={(event) =>
                                patchRow(index, {
                                  referencesEntityId: event.target.value || undefined,
                                })
                              }
                            >
                              <option value="">—</option>
                              {entityList
                                .filter((entity) => entity.id !== targetKey)
                                .map((entity) => (
                                  <option key={entity.id} value={entity.id}>
                                    {entity.name || "Untitled entity"}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="bulk-cell-input"
                              value={row.description}
                              aria-label={`Description for ${row.name || `row ${index + 1}`}`}
                              onChange={(event) =>
                                patchRow(index, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button danger"
                              aria-label={`Remove ${row.name || `row ${index + 1}`}`}
                              onClick={() =>
                                commitStaging(
                                  stagedRows.filter(
                                    (_, rowIndex) => rowIndex !== index,
                                  ),
                                )
                              }
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {stagedRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="bulk-import-empty-row">
                          No attribute names found. Check the column mapping above or
                          add a row manually.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <footer className="export-dialog-footer">
          <span className="bulk-import-hint">
            {included.length > 0
              ? `${included.length} attribute${included.length === 1 ? "" : "s"} · ⌘⏎ to add`
              : "⌘⏎ to add"}
          </span>
          <button
            type="button"
            className="button button-secondary"
            onClick={closeBulkImport}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!canCommit}
            onClick={commit}
          >
            {creatingEntity
              ? `Create entity (${included.length})`
              : `Add ${included.length} attribute${included.length === 1 ? "" : "s"}`}
          </button>
        </footer>
      </section>
    </div>
  );
}

function sampleCell(rows: string[][], hasHeader: boolean, columnIndex: number): string {
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const value = dataRows
    .map((row) => (row[columnIndex] ?? "").trim())
    .find((cell) => cell.length > 0);
  if (!value) return "";
  return value.length > 16 ? `${value.slice(0, 15)}…` : value;
}
