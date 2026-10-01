import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Box,
  ClipboardPaste,
  Copy,
  GripVertical,
  KeyRound,
  Link2,
  LockKeyhole,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ATTRIBUTE_SORT_OPTIONS,
  sortAttributes,
  type AttributeSortMode,
} from "../domain/attributeOrder";
import {
  isNaryRelationship,
  type Cardinality,
  type EntityIdentifier,
  type IdentifierKind,
  type InversionEntry,
  type RelationshipKind,
} from "../domain/model";
import { CardinalitySelect } from "./CardinalitySelect";
import { LogicalTypeSelect } from "./LogicalTypeSelect";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";

const ENTITY_COLOR_PRESETS = [
  { name: "Midnight", value: "#29243d" },
  { name: "Purple", value: "#6d4bb9" },
  { name: "Blue", value: "#356e9f" },
  { name: "Teal", value: "#2f7d76" },
  { name: "Green", value: "#4f7a4b" },
  { name: "Amber", value: "#91652f" },
  { name: "Rose", value: "#934c5b" },
  { name: "Slate", value: "#4f5968" },
] as const;

export function Inspector() {
  const project = useProjectStore((state) => state.project);
  const activeDiagramId = useProjectStore((state) => state.activeDiagramId);
  const selection = useProjectStore((state) => state.selection);
  const confirm = useUiStore((state) => state.confirm);

  const updateProject = useProjectStore((state) => state.updateProject);
  const updateEntity = useProjectStore((state) => state.updateEntity);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const duplicateEntity = useProjectStore((state) => state.duplicateEntity);
  const addAttribute = useProjectStore((state) => state.addAttribute);
  const updateAttribute = useProjectStore((state) => state.updateAttribute);
  const moveAttribute = useProjectStore((state) => state.moveAttribute);
  const reorderAttributes = useProjectStore((state) => state.reorderAttributes);
  const deleteAttribute = useProjectStore((state) => state.deleteAttribute);
  const addIdentifier = useProjectStore((state) => state.addIdentifier);
  const updateIdentifier = useProjectStore((state) => state.updateIdentifier);
  const deleteIdentifier = useProjectStore((state) => state.deleteIdentifier);
  const addInversionEntry = useProjectStore((state) => state.addInversionEntry);
  const updateInversionEntry = useProjectStore((state) => state.updateInversionEntry);
  const deleteInversionEntry = useProjectStore((state) => state.deleteInversionEntry);
  const updateRelationship = useProjectStore((state) => state.updateRelationship);
  const updateRelationshipVertices = useProjectStore(
    (state) => state.updateRelationshipVertices,
  );
  const setRelationshipParticipants = useProjectStore(
    (state) => state.setRelationshipParticipants,
  );
  const deleteRelationship = useProjectStore((state) => state.deleteRelationship);
  const toggleEntityCollapsed = useProjectStore((state) => state.toggleEntityCollapsed);
  const toggleEntityPinned = useProjectStore((state) => state.toggleEntityPinned);
  const addDiagramNote = useProjectStore((state) => state.addDiagramNote);
  const updateDiagramNote = useProjectStore((state) => state.updateDiagramNote);
  const deleteDiagramNote = useProjectStore((state) => state.deleteDiagramNote);
  const setSelection = useProjectStore((state) => state.setSelection);
  const updateSubjectArea = useProjectStore((state) => state.updateSubjectArea);
  const deleteSubjectArea = useProjectStore((state) => state.deleteSubjectArea);
  const openBulkImport = useUiStore((state) => state.openBulkImport);

  const [dragAttributeId, setDragAttributeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    after: boolean;
  } | null>(null);

  const focusAttribute = useCallback((attributeId: string) => {
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-attribute-name="${CSS.escape(attributeId)}"]`,
      );
      input?.closest(".attribute-editor")?.scrollIntoView({ block: "nearest" });
      input?.focus();
      input?.select();
    });
  }, []);

  // Canvas attribute-row clicks land here: scroll the matching row into view
  // and focus its name field so typing edits immediately.
  const canvasAttributeId =
    selection?.kind === "entity" ? selection.attributeId : undefined;
  const canvasEntityId = selection?.kind === "entity" ? selection.id : undefined;
  useEffect(() => {
    if (!canvasAttributeId) return;
    focusAttribute(canvasAttributeId);
  }, [canvasAttributeId, canvasEntityId, focusAttribute]);

  if (!selection) {
    const diagram = project.diagrams[activeDiagramId];
    return (
      <aside className="inspector">
        <div className="inspector-header">
          <div className="inspector-title-icon project">
            <LockKeyhole size={16} />
          </div>
          <div>
            <span className="eyebrow">Project</span>
            <h2>{project.name || "Untitled model"}</h2>
          </div>
        </div>
        <div className="inspector-scroll">
          <section className="property-section">
            <label className="field-label" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              className="text-field"
              value={project.name}
              onChange={(event) => updateProject({ name: event.target.value })}
              placeholder="Project name"
            />
            <label className="field-label" htmlFor="project-description">
              Description
            </label>
            <textarea
              id="project-description"
              className="text-field textarea"
              value={project.description}
              onChange={(event) => updateProject({ description: event.target.value })}
              placeholder="What does this logical model describe?"
              rows={4}
            />
          </section>
          <section className="property-section inspector-overview">
            <span className="eyebrow">Active diagram</span>
            <h3>{diagram?.name ?? "Diagram"}</h3>
            <dl>
              <div>
                <dt>Entities</dt>
                <dd>{Object.keys(project.model.entities).length}</dd>
              </div>
              <div>
                <dt>Relationships</dt>
                <dd>{Object.keys(project.model.relationships).length}</dd>
              </div>
              <div>
                <dt>Visible here</dt>
                <dd>{Object.keys(diagram?.entityViews ?? {}).length}</dd>
              </div>
            </dl>
          </section>
          <div className="inspector-tip project-tip">
            <strong>Keyboard workflow</strong>
            Use ⌘E to add an entity, ⌘D to duplicate one, and ⌘Z / ⇧⌘Z to undo or redo
            model changes.
          </div>
        </div>
      </aside>
    );
  }

  if (selection.kind === "entity") {
    const entity = project.model.entities[selection.id];
    const focusedAttributeId = selection.attributeId ?? null;
    const view = project.diagrams[activeDiagramId]?.entityViews[selection.id] ?? null;
    const comments = Object.values(
      project.diagrams[activeDiagramId]?.notes ?? {},
    ).filter((note) => note.entityId === selection.id);
    if (!entity) return null;

    const addAndFocusAttribute = (afterAttributeId?: string) => {
      const attributeId = addAttribute(entity.id, afterAttributeId);
      focusAttribute(attributeId);
    };

    return (
      <aside className="inspector">
        <div className="inspector-header">
          <div className="inspector-title-icon entity">
            <Box size={16} />
          </div>
          <div>
            <span className="eyebrow">Entity</span>
            <h2>{entity.name || "Untitled entity"}</h2>
          </div>
          <div className="inspector-header-actions">
            <button
              type="button"
              className="icon-button"
              title="Duplicate entity (⌘D)"
              aria-label="Duplicate entity"
              onClick={() => duplicateEntity(entity.id)}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              className="icon-button danger"
              title="Delete entity"
              aria-label="Delete entity"
              onClick={async () => {
                const accepted = await confirm({
                  title: "Delete entity?",
                  message: `Delete “${
                    entity.name || "Untitled entity"
                  }” and all of its relationships?`,
                  confirmLabel: "Delete entity",
                  destructive: true,
                });
                if (accepted) deleteEntity(entity.id);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="inspector-scroll">
          <section className="property-section">
            <label className="field-label" htmlFor="entity-name">
              Name
            </label>
            <input
              id="entity-name"
              className="text-field"
              value={entity.name}
              onChange={(event) =>
                updateEntity(entity.id, { name: event.target.value })
              }
              placeholder="Entity name"
            />
            <span className="field-label">Entity color</span>
            <div className="entity-color-picker" aria-label="Entity color">
              <div className="entity-color-presets">
                {ENTITY_COLOR_PRESETS.map((color) => (
                  <button
                    type="button"
                    className={entity.color === color.value ? "selected" : ""}
                    key={color.value}
                    title={color.name}
                    aria-label={`Use ${color.name} entity color`}
                    aria-pressed={entity.color === color.value}
                    style={{ backgroundColor: color.value }}
                    onClick={() => updateEntity(entity.id, { color: color.value })}
                  />
                ))}
              </div>
              <label className="entity-custom-color">
                <input
                  id="entity-color"
                  type="color"
                  value={entity.color}
                  aria-label="Custom entity color"
                  onChange={(event) =>
                    updateEntity(entity.id, { color: event.target.value })
                  }
                />
                <span>Custom</span>
                <code>{entity.color.toUpperCase()}</code>
              </label>
            </div>
            <label className="field-label" htmlFor="entity-description">
              Description
            </label>
            <textarea
              id="entity-description"
              className="text-field textarea"
              value={entity.description}
              onChange={(event) =>
                updateEntity(entity.id, { description: event.target.value })
              }
              placeholder="What does this entity represent?"
              rows={3}
            />
            {view && (
              <div className="inline-text-actions">
                <button
                  type="button"
                  className="text-action"
                  onClick={() => toggleEntityCollapsed(activeDiagramId, entity.id)}
                >
                  {view.collapsed ? "Expand on canvas" : "Collapse on canvas"}
                </button>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => toggleEntityPinned(activeDiagramId, entity.id)}
                >
                  {view.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                  {view.pinned ? "Unpin position" : "Pin position"}
                </button>
              </div>
            )}
          </section>

          <section className="property-section attributes-section">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Structure</span>
                <h3>Attributes</h3>
              </div>
              <div className="section-heading-actions">
                <select
                  className="compact-select arrange-select"
                  value=""
                  aria-label="Arrange attributes"
                  title="Reorder all attributes at once"
                  onChange={(event) => {
                    const mode = event.target.value as AttributeSortMode;
                    if (!mode) return;
                    reorderAttributes(
                      entity.id,
                      sortAttributes(
                        entity,
                        mode,
                        Object.values(project.model.relationships),
                      ).map((attribute) => attribute.id),
                    );
                    event.target.value = "";
                  }}
                >
                  <option value="" disabled>
                    Arrange…
                  </option>
                  {ATTRIBUTE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="small-button"
                  title="Paste attribute rows copied from a spreadsheet"
                  onClick={() => openBulkImport(entity.id)}
                >
                  <ClipboardPaste size={13} /> Paste
                </button>
                <button
                  type="button"
                  className="small-button"
                  onClick={() => addAndFocusAttribute()}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>

            <div
              className="attribute-editor-list"
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDropTarget(null);
                }
              }}
            >
              {entity.attributes.map((attribute, index) => (
                <div
                  className={`attribute-editor${
                    dropTarget?.id === attribute.id
                      ? dropTarget.after
                        ? " drop-after"
                        : " drop-before"
                      : ""
                  }${dragAttributeId === attribute.id ? " dragging" : ""}${
                    focusedAttributeId === attribute.id ? " focused" : ""
                  }`}
                  key={attribute.id}
                  data-attribute-row={attribute.id}
                  onDragOver={(event) => {
                    if (!dragAttributeId || dragAttributeId === attribute.id) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setDropTarget({
                      id: attribute.id,
                      after: event.clientY > rect.top + rect.height / 2,
                    });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!dragAttributeId) return;
                    const sourceIndex = entity.attributes.findIndex(
                      (candidate) => candidate.id === dragAttributeId,
                    );
                    if (sourceIndex < 0) return;
                    const after = dropTarget?.id === attribute.id && dropTarget.after;
                    let targetIndex = after ? index + 1 : index;
                    if (sourceIndex < targetIndex) targetIndex -= 1;
                    moveAttribute(entity.id, dragAttributeId, targetIndex);
                    setDragAttributeId(null);
                    setDropTarget(null);
                  }}
                  onDragEnd={() => {
                    setDragAttributeId(null);
                    setDropTarget(null);
                  }}
                >
                  <div className="attribute-order-controls">
                    <span
                      className="attribute-drag-handle"
                      title="Drag to reorder"
                      draggable
                      aria-label={`Drag ${attribute.name || "attribute"} to reorder`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", attribute.id);
                        setDragAttributeId(attribute.id);
                      }}
                    >
                      <GripVertical size={11} />
                    </span>
                    <span>{index + 1}</span>
                    <button
                      type="button"
                      title="Move attribute up — ⇧-click moves to top"
                      aria-label={`Move ${attribute.name || "attribute"} up`}
                      disabled={index === 0}
                      onClick={(event) =>
                        moveAttribute(
                          entity.id,
                          attribute.id,
                          event.shiftKey || event.metaKey ? 0 : index - 1,
                        )
                      }
                    >
                      <ArrowUp size={10} />
                    </button>
                    <button
                      type="button"
                      title="Move attribute down — ⇧-click moves to bottom"
                      aria-label={`Move ${attribute.name || "attribute"} down`}
                      disabled={index === entity.attributes.length - 1}
                      onClick={(event) =>
                        moveAttribute(
                          entity.id,
                          attribute.id,
                          event.shiftKey || event.metaKey
                            ? entity.attributes.length - 1
                            : index + 1,
                        )
                      }
                    >
                      <ArrowDown size={10} />
                    </button>
                  </div>
                  <div className="attribute-fields">
                    <input
                      data-attribute-name={attribute.id}
                      className="inline-field attribute-name-field"
                      value={attribute.name}
                      onChange={(event) =>
                        updateAttribute(entity.id, attribute.id, {
                          name: event.target.value,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addAndFocusAttribute(attribute.id);
                        }
                        if (event.altKey && event.key === "ArrowUp") {
                          event.preventDefault();
                          moveAttribute(entity.id, attribute.id, index - 1);
                        }
                        if (event.altKey && event.key === "ArrowDown") {
                          event.preventDefault();
                          moveAttribute(entity.id, attribute.id, index + 1);
                        }
                      }}
                      placeholder="Attribute name"
                      aria-label={`Attribute ${index + 1} name`}
                    />
                    <LogicalTypeSelect
                      className="inline-field type-field type-select"
                      value={attribute.logicalType}
                      onChange={(value) =>
                        updateAttribute(entity.id, attribute.id, {
                          logicalType: value,
                        })
                      }
                      ariaLabel={`Attribute ${index + 1} logical type`}
                    />
                    <input
                      className="inline-field attribute-description-field"
                      value={attribute.description}
                      onChange={(event) =>
                        updateAttribute(entity.id, attribute.id, {
                          description: event.target.value,
                        })
                      }
                      placeholder="Business definition (optional)"
                      aria-label={`Attribute ${index + 1} description`}
                    />
                  </div>
                  <div className="attribute-actions">
                    <button
                      type="button"
                      className={`attribute-toggle ${
                        attribute.isIdentifier ? "active" : ""
                      }`}
                      title="Toggle primary identifier membership"
                      onClick={() =>
                        updateAttribute(entity.id, attribute.id, {
                          isIdentifier: !attribute.isIdentifier,
                        })
                      }
                    >
                      <KeyRound size={12} /> ID
                    </button>
                    <button
                      type="button"
                      className={`attribute-toggle ${
                        attribute.isRequired ? "active required" : ""
                      }`}
                      title="Required attribute"
                      onClick={() =>
                        updateAttribute(entity.id, attribute.id, {
                          isRequired: !attribute.isRequired,
                        })
                      }
                    >
                      Required
                    </button>
                    <button
                      type="button"
                      className="attribute-delete"
                      title="Delete attribute"
                      aria-label={`Delete ${attribute.name || "attribute"}`}
                      onClick={() => deleteAttribute(entity.id, attribute.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {entity.attributes.length === 0 && (
                <button
                  type="button"
                  className="empty-attributes"
                  onClick={() => addAndFocusAttribute()}
                >
                  <Plus size={15} />
                  Add the first attribute
                </button>
              )}
            </div>
          </section>

          <section className="property-section identifier-section">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Identity</span>
                <h3>Identifiers</h3>
              </div>
              <button
                type="button"
                className="small-button"
                disabled={entity.attributes.length === 0}
                onClick={() => addIdentifier(entity.id, "alternate")}
              >
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="identifier-list">
              {entity.identifiers.map((identifier) => (
                <IdentifierEditor
                  key={identifier.id}
                  identifier={identifier}
                  attributes={entity.attributes}
                  onChange={(changes) =>
                    updateIdentifier(entity.id, identifier.id, changes)
                  }
                  onDelete={() => deleteIdentifier(entity.id, identifier.id)}
                />
              ))}
              {entity.identifiers.length === 0 && (
                <p className="empty-copy">
                  Add a primary or alternate identifier. An identifier may use one or
                  several attributes.
                </p>
              )}
            </div>
          </section>

          <section className="property-section inversion-section">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Access paths</span>
                <h3>Inversion entries</h3>
              </div>
              <button
                type="button"
                className="small-button"
                disabled={entity.attributes.length === 0}
                onClick={() => addInversionEntry(entity.id)}
              >
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="identifier-list">
              {entity.inversionEntries.map((entry) => (
                <InversionEntryEditor
                  key={entry.id}
                  entry={entry}
                  attributes={entity.attributes}
                  onChange={(changes) =>
                    updateInversionEntry(entity.id, entry.id, changes)
                  }
                  onDelete={() => deleteInversionEntry(entity.id, entry.id)}
                />
              ))}
              {entity.inversionEntries.length === 0 && (
                <p className="empty-copy">
                  Inversion entries record non-identifying access paths — attribute sets
                  that are meaningful ways to reach occurrences without asserting
                  uniqueness.
                </p>
              )}
            </div>
          </section>

          <section className="property-section comments-section">
            <div className="property-section-heading">
              <div>
                <span className="eyebrow">Review</span>
                <h3>Comments</h3>
              </div>
              {view && (
                <button
                  type="button"
                  className="small-button"
                  title="Attach a comment note next to this entity on the diagram"
                  onClick={() => addDiagramNote(activeDiagramId, undefined, entity.id)}
                >
                  <Plus size={13} /> Add comment
                </button>
              )}
            </div>
            <div className="identifier-list">
              {comments.map((note) => (
                <button
                  type="button"
                  key={note.id}
                  className="comment-item"
                  title="Select comment on the diagram"
                  onClick={() => setSelection({ kind: "note", id: note.id })}
                >
                  {note.text.trim() || "Empty comment"}
                </button>
              ))}
              {comments.length === 0 && (
                <p className="empty-copy">
                  {view
                    ? "Comments are sticky notes anchored to this entity — handy for review-meeting feedback. They move with the entity and live on this diagram."
                    : "Show this entity on the diagram to attach comments."}
                </p>
              )}
            </div>
          </section>
        </div>
      </aside>
    );
  }

  const activeDiagram = project.diagrams[activeDiagramId];
  if (selection.kind === "note") {
    const note = activeDiagram?.notes[selection.id];
    if (!note) return null;
    const attachedEntity = note.entityId
      ? project.model.entities[note.entityId]
      : undefined;
    const attachCandidates = Object.keys(activeDiagram?.entityViews ?? {});
    return (
      <aside className="inspector">
        <div className="inspector-header">
          <div className="inspector-title-icon note">
            <span>✎</span>
          </div>
          <div>
            <span className="eyebrow">
              {attachedEntity ? "Comment" : "Diagram note"}
            </span>
            <h2>{attachedEntity ? `On ${attachedEntity.name}` : "Note"}</h2>
          </div>
          <button
            type="button"
            className="icon-button danger"
            aria-label="Delete note"
            onClick={() => deleteDiagramNote(activeDiagramId, note.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="inspector-scroll">
          <section className="property-section">
            <label className="field-label" htmlFor="note-text">
              Text
            </label>
            <textarea
              id="note-text"
              className="text-field textarea note-textarea"
              rows={8}
              value={note.text}
              onChange={(event) =>
                updateDiagramNote(activeDiagramId, note.id, {
                  text: event.target.value,
                })
              }
            />
            <label className="field-label" htmlFor="note-color">
              Color
            </label>
            <input
              id="note-color"
              className="color-field"
              type="color"
              value={note.color}
              onChange={(event) =>
                updateDiagramNote(activeDiagramId, note.id, {
                  color: event.target.value,
                })
              }
            />
            <DimensionFields
              width={note.width}
              height={note.height}
              onChange={(changes) =>
                updateDiagramNote(activeDiagramId, note.id, changes)
              }
            />
            <label className="field-label" htmlFor="note-attach">
              Attached to
            </label>
            <select
              id="note-attach"
              className="select-field"
              value={note.entityId ?? ""}
              onChange={(event) =>
                updateDiagramNote(activeDiagramId, note.id, {
                  entityId: event.target.value || undefined,
                })
              }
            >
              <option value="">Free-floating note</option>
              {attachCandidates.map((entityId) => (
                <option key={entityId} value={entityId}>
                  {project.model.entities[entityId]?.name || "Untitled entity"}
                </option>
              ))}
            </select>
            <p className="empty-copy">
              An attached note is a comment — it follows its entity, hides when the
              entity is hidden, and is removed if the entity is deleted.
            </p>
          </section>
        </div>
      </aside>
    );
  }

  if (selection.kind === "subject-area") {
    const subjectArea = activeDiagram?.subjectAreas[selection.id];
    if (!subjectArea) return null;
    return (
      <aside className="inspector">
        <div className="inspector-header">
          <div className="inspector-title-icon subject">
            <span>▧</span>
          </div>
          <div>
            <span className="eyebrow">Subject area</span>
            <h2>{subjectArea.name}</h2>
          </div>
          <button
            type="button"
            className="icon-button danger"
            aria-label="Delete subject area"
            onClick={() => deleteSubjectArea(activeDiagramId, subjectArea.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="inspector-scroll">
          <section className="property-section">
            <label className="field-label" htmlFor="subject-name">
              Name
            </label>
            <input
              id="subject-name"
              className="text-field"
              value={subjectArea.name}
              onChange={(event) =>
                updateSubjectArea(activeDiagramId, subjectArea.id, {
                  name: event.target.value,
                })
              }
            />
            <label className="field-label" htmlFor="subject-description">
              Description
            </label>
            <textarea
              id="subject-description"
              className="text-field textarea"
              rows={4}
              value={subjectArea.description}
              onChange={(event) =>
                updateSubjectArea(activeDiagramId, subjectArea.id, {
                  description: event.target.value,
                })
              }
            />
            <label className="field-label" htmlFor="subject-color">
              Color
            </label>
            <input
              id="subject-color"
              className="color-field"
              type="color"
              value={subjectArea.color}
              onChange={(event) =>
                updateSubjectArea(activeDiagramId, subjectArea.id, {
                  color: event.target.value,
                })
              }
            />
            <DimensionFields
              width={subjectArea.width}
              height={subjectArea.height}
              onChange={(changes) =>
                updateSubjectArea(activeDiagramId, subjectArea.id, changes)
              }
            />
          </section>
        </div>
      </aside>
    );
  }

  const relationship = project.model.relationships[selection.id];
  if (!relationship) return null;
  const source = project.model.entities[relationship.sourceEntityId];
  const target = project.model.entities[relationship.targetEntityId];

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div className="inspector-title-icon relationship">
          <Link2 size={16} />
        </div>
        <div>
          <span className="eyebrow">Relationship</span>
          <h2>{relationship.name || "Unnamed relationship"}</h2>
        </div>
        <button
          type="button"
          className="icon-button danger"
          title="Delete relationship"
          aria-label="Delete relationship"
          onClick={async () => {
            const accepted = await confirm({
              title: "Delete relationship?",
              message: `Delete the relationship between “${
                source?.name ?? "Entity"
              }” and “${target?.name ?? "Entity"}”${
                relationship.participants?.length
                  ? ` (+${relationship.participants.length - 2} more participants)`
                  : ""
              }?`,
              confirmLabel: "Delete relationship",
              destructive: true,
            });
            if (accepted) deleteRelationship(relationship.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="inspector-scroll">
        <section className="property-section">
          <label className="field-label" htmlFor="relationship-kind">
            Relationship type
          </label>
          <select
            id="relationship-kind"
            className="select-field"
            value={relationship.kind}
            onChange={(event) =>
              updateRelationship(relationship.id, {
                kind: event.target.value as RelationshipKind,
              })
            }
          >
            <option value="association">Association</option>
            <option value="inheritance">Subtype / supertype</option>
          </select>
          <label className="field-label" htmlFor="relationship-name">
            Name
          </label>
          <input
            id="relationship-name"
            className="text-field"
            value={relationship.name}
            onChange={(event) =>
              updateRelationship(relationship.id, { name: event.target.value })
            }
            placeholder="Optional label, e.g. places"
          />
          <label className="field-label" htmlFor="relationship-description">
            Description
          </label>
          <textarea
            id="relationship-description"
            className="text-field textarea"
            value={relationship.description}
            onChange={(event) =>
              updateRelationship(relationship.id, {
                description: event.target.value,
              })
            }
            placeholder="Describe this relationship"
            rows={3}
          />
          <div className="role-name-fields">
            <label>
              Source role
              <input
                className="text-field"
                value={relationship.sourceRole}
                onChange={(event) =>
                  updateRelationship(relationship.id, {
                    sourceRole: event.target.value,
                  })
                }
                placeholder="Role name"
              />
            </label>
            <label>
              Target role
              <input
                className="text-field"
                value={relationship.targetRole}
                onChange={(event) =>
                  updateRelationship(relationship.id, {
                    targetRole: event.target.value,
                  })
                }
                placeholder="Role name"
              />
            </label>
          </div>
        </section>

        {isNaryRelationship(relationship) ? (
          <section className="property-section relationship-ends">
            <span className="eyebrow">Participants & cardinality</span>
            <p className="dialog-inline-note">
              N-ary relationship — rendered as a hub with one leg per participant.
            </p>
            {(relationship.participants ?? []).map((participant, index) => (
              <div key={participant.id} className="participant-editor">
                <RelationshipEndEditor
                  role={`Participant ${index + 1}`}
                  accent={index % 2 === 0 ? "source" : "target"}
                  entities={Object.values(project.model.entities)}
                  entity={project.model.entities[participant.entityId]}
                  entityId={participant.entityId}
                  attributeId={participant.attributeId}
                  cardinality={participant.cardinality}
                  showCardinality={relationship.kind === "association"}
                  onEntityChange={(entityId) =>
                    setRelationshipParticipants(
                      relationship.id,
                      (relationship.participants ?? []).map((item) =>
                        item.id === participant.id
                          ? { ...item, entityId, attributeId: null }
                          : item,
                      ),
                    )
                  }
                  onAttributeChange={(attributeId) =>
                    setRelationshipParticipants(
                      relationship.id,
                      (relationship.participants ?? []).map((item) =>
                        item.id === participant.id ? { ...item, attributeId } : item,
                      ),
                    )
                  }
                  onCardinalityChange={(cardinality) =>
                    setRelationshipParticipants(
                      relationship.id,
                      (relationship.participants ?? []).map((item) =>
                        item.id === participant.id ? { ...item, cardinality } : item,
                      ),
                    )
                  }
                />
                <label>
                  Role
                  <input
                    className="text-field"
                    value={participant.role}
                    onChange={(event) =>
                      setRelationshipParticipants(
                        relationship.id,
                        (relationship.participants ?? []).map((item) =>
                          item.id === participant.id
                            ? { ...item, role: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Role name"
                  />
                </label>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Remove participant ${index + 1}`}
                  title="Remove participant"
                  onClick={() =>
                    setRelationshipParticipants(
                      relationship.id,
                      (relationship.participants ?? []).filter(
                        (item) => item.id !== participant.id,
                      ),
                    )
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="small-button"
              onClick={() => {
                const unused =
                  Object.values(project.model.entities).find(
                    (entity) =>
                      !(relationship.participants ?? []).some(
                        (participant) => participant.entityId === entity.id,
                      ),
                  ) ?? Object.values(project.model.entities)[0];
                if (!unused) return;
                setRelationshipParticipants(relationship.id, [
                  ...(relationship.participants ?? []),
                  { entityId: unused.id },
                ]);
              }}
            >
              <Plus size={13} /> Add participant
            </button>
          </section>
        ) : (
          <section className="property-section relationship-ends">
            <span className="eyebrow">Endpoints & cardinality</span>
            <RelationshipEndEditor
              role="Source"
              accent="source"
              entities={Object.values(project.model.entities)}
              entity={source}
              entityId={relationship.sourceEntityId}
              attributeId={relationship.sourceAttributeId}
              cardinality={relationship.sourceCardinality}
              showCardinality={relationship.kind === "association"}
              onEntityChange={(entityId) =>
                updateRelationship(relationship.id, {
                  sourceEntityId: entityId,
                  sourceAttributeId: null,
                })
              }
              onAttributeChange={(sourceAttributeId) =>
                updateRelationship(relationship.id, { sourceAttributeId })
              }
              onCardinalityChange={(sourceCardinality) =>
                updateRelationship(relationship.id, { sourceCardinality })
              }
            />
            <div className="relationship-line-preview">
              <span />
              <Link2 size={13} />
              <span />
            </div>
            <RelationshipEndEditor
              role="Target"
              accent="target"
              entities={Object.values(project.model.entities)}
              entity={target}
              entityId={relationship.targetEntityId}
              attributeId={relationship.targetAttributeId}
              cardinality={relationship.targetCardinality}
              showCardinality={relationship.kind === "association"}
              onEntityChange={(entityId) =>
                updateRelationship(relationship.id, {
                  targetEntityId: entityId,
                  targetAttributeId: null,
                })
              }
              onAttributeChange={(targetAttributeId) =>
                updateRelationship(relationship.id, { targetAttributeId })
              }
              onCardinalityChange={(targetCardinality) =>
                updateRelationship(relationship.id, { targetCardinality })
              }
            />
          </section>
        )}

        <section className="property-section">
          <div className="relationship-route-control">
            <div>
              <strong>Manual line routing</strong>
              <span>
                Select the line, then drag its purple routing handles. Routing is stored
                only for this diagram.
              </span>
            </div>
            <button
              type="button"
              className="small-button"
              disabled={
                !activeDiagram.relationshipViews[relationship.id]?.vertices.length
              }
              onClick={() =>
                updateRelationshipVertices(activeDiagramId, relationship.id, [])
              }
            >
              Reset
            </button>
          </div>
        </section>

        <section className="property-section">
          <label className="check-row">
            <input
              type="checkbox"
              checked={relationship.isIdentifying}
              onChange={(event) =>
                updateRelationship(relationship.id, {
                  isIdentifying: event.target.checked,
                })
              }
            />
            <span>
              <strong>Identifying relationship</strong>
              The parent identity contributes to the child identity.
            </span>
          </label>
        </section>
      </div>
    </aside>
  );
}

function DimensionFields({
  width,
  height,
  onChange,
}: {
  width: number;
  height: number;
  onChange: (changes: { width?: number; height?: number }) => void;
}) {
  return (
    <div className="dimension-fields">
      <label>
        Width
        <input
          type="number"
          min={80}
          max={10_000}
          value={width}
          onChange={(event) =>
            onChange({ width: Math.max(80, Number(event.target.value) || 80) })
          }
        />
      </label>
      <label>
        Height
        <input
          type="number"
          min={60}
          max={10_000}
          value={height}
          onChange={(event) =>
            onChange({ height: Math.max(60, Number(event.target.value) || 60) })
          }
        />
      </label>
    </div>
  );
}

interface IdentifierEditorProps {
  identifier: EntityIdentifier;
  attributes: Array<{ id: string; name: string }>;
  onChange: (changes: Partial<EntityIdentifier>) => void;
  onDelete: () => void;
}

function IdentifierEditor({
  identifier,
  attributes,
  onChange,
  onDelete,
}: IdentifierEditorProps) {
  return (
    <div className="identifier-editor">
      <div className="identifier-editor-heading">
        <input
          className="inline-field"
          value={identifier.name}
          aria-label="Identifier name"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <select
          className="compact-select"
          value={identifier.kind}
          aria-label="Identifier kind"
          onChange={(event) => onChange({ kind: event.target.value as IdentifierKind })}
        >
          <option value="primary">Primary</option>
          <option value="alternate">Alternate</option>
        </select>
        <button
          type="button"
          className="attribute-delete"
          title="Delete identifier"
          aria-label="Delete identifier"
          onClick={onDelete}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="identifier-attributes">
        {attributes.map((attribute) => {
          const checked = identifier.attributeIds.includes(attribute.id);
          return (
            <label key={attribute.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? identifier.attributeIds.filter((id) => id !== attribute.id)
                    : [...identifier.attributeIds, attribute.id];
                  if (next.length > 0) onChange({ attributeIds: next });
                }}
              />
              <span>{attribute.name || "Untitled attribute"}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface InversionEntryEditorProps {
  entry: InversionEntry;
  attributes: Array<{ id: string; name: string }>;
  onChange: (changes: Partial<InversionEntry>) => void;
  onDelete: () => void;
}

function InversionEntryEditor({
  entry,
  attributes,
  onChange,
  onDelete,
}: InversionEntryEditorProps) {
  return (
    <div className="identifier-editor">
      <div className="identifier-editor-heading">
        <input
          className="inline-field"
          value={entry.name}
          aria-label="Inversion entry name"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <button
          type="button"
          className="attribute-delete"
          title="Delete inversion entry"
          aria-label="Delete inversion entry"
          onClick={onDelete}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <input
        className="inline-field inversion-entry-description"
        value={entry.description}
        aria-label="Inversion entry description"
        placeholder="Access path description"
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <div className="identifier-attributes">
        {attributes.map((attribute) => {
          const checked = entry.attributeIds.includes(attribute.id);
          return (
            <label key={attribute.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? entry.attributeIds.filter((id) => id !== attribute.id)
                    : [...entry.attributeIds, attribute.id];
                  if (next.length > 0) onChange({ attributeIds: next });
                }}
              />
              <span>{attribute.name || "Untitled attribute"}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface RelationshipEndEditorProps {
  role: string;
  accent: "source" | "target";
  entities: Array<{ id: string; name: string }>;
  entity:
    | { id: string; name: string; attributes: Array<{ id: string; name: string }> }
    | undefined;
  entityId: string;
  attributeId: string | null;
  cardinality: Cardinality;
  showCardinality: boolean;
  onEntityChange: (entityId: string) => void;
  onAttributeChange: (attributeId: string | null) => void;
  onCardinalityChange: (cardinality: Cardinality) => void;
}

function RelationshipEndEditor({
  role,
  accent,
  entities,
  entity,
  entityId,
  attributeId,
  cardinality,
  showCardinality,
  onEntityChange,
  onAttributeChange,
  onCardinalityChange,
}: RelationshipEndEditorProps) {
  return (
    <div className="relationship-end">
      <div className="relationship-entity-name">
        <span className={`endpoint-dot ${accent}`} />
        {role} endpoint
      </div>
      <label className="relationship-control-label">Entity</label>
      <select
        className="select-field"
        aria-label={`${role} entity`}
        value={entityId}
        onChange={(event) => onEntityChange(event.target.value)}
      >
        {entities.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name || "Untitled entity"}
          </option>
        ))}
      </select>
      <label className="relationship-control-label">Connected attribute</label>
      <select
        className="select-field"
        aria-label={`${role} connected attribute`}
        value={attributeId ?? ""}
        onChange={(event) => onAttributeChange(event.target.value || null)}
      >
        <option value="">Entity boundary</option>
        {entity?.attributes.map((attribute) => (
          <option key={attribute.id} value={attribute.id}>
            {attribute.name || "Untitled attribute"}
          </option>
        ))}
      </select>
      {showCardinality && (
        <>
          <label className="relationship-control-label">Cardinality</label>
          <CardinalitySelect
            ariaLabel={`${role} cardinality`}
            value={cardinality}
            onChange={onCardinalityChange}
          />
        </>
      )}
    </div>
  );
}
