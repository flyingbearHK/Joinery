import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import {
  CARDINALITY_OPTIONS,
  type Cardinality,
  type RelationshipKind,
} from "../domain/model";
import { createId } from "../domain/project";
import { useProjectStore } from "../state/projectStore";

interface RelationshipDialogProps {
  open: boolean;
  onClose: () => void;
}

export function RelationshipDialog({ open, onClose }: RelationshipDialogProps) {
  return open ? <RelationshipDialogContent onClose={onClose} /> : null;
}

function RelationshipDialogContent({
  onClose,
}: Pick<RelationshipDialogProps, "onClose">) {
  const project = useProjectStore((state) => state.project);
  const activeDiagramId = useProjectStore((state) => state.activeDiagramId);
  const addRelationship = useProjectStore((state) => state.addRelationship);
  const ensureEntityVisible = useProjectStore((state) => state.ensureEntityVisible);
  const entities = useMemo(
    () =>
      Object.values(project.model.entities).sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [project.model.entities],
  );
  const availablePair = (() => {
    for (const source of entities) {
      for (const target of entities) {
        if (source.id === target.id) continue;
        const exists = Object.values(project.model.relationships).some(
          (relationship) =>
            (relationship.sourceEntityId === source.id &&
              relationship.targetEntityId === target.id) ||
            (relationship.sourceEntityId === target.id &&
              relationship.targetEntityId === source.id),
        );
        if (!exists) return [source.id, target.id] as const;
      }
    }
    const fallback = entities[0]?.id ?? "";
    return [fallback, entities[1]?.id ?? fallback] as const;
  })();
  const [firstEntityId, secondEntityId] = availablePair;
  const [sourceEntityId, setSourceEntityId] = useState(firstEntityId);
  const [targetEntityId, setTargetEntityId] = useState(secondEntityId);
  const [sourceAttributeId, setSourceAttributeId] = useState("");
  const [targetAttributeId, setTargetAttributeId] = useState("");
  const [sourceCardinality, setSourceCardinality] =
    useState<Cardinality>("exactly-one");
  const [targetCardinality, setTargetCardinality] =
    useState<Cardinality>("zero-or-many");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RelationshipKind>("association");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const source = project.model.entities[sourceEntityId];
  const target = project.model.entities[targetEntityId];
  const canCreate = Boolean(
    sourceEntityId &&
    targetEntityId &&
    (kind === "association" || sourceEntityId !== targetEntityId),
  );

  const createRelationship = () => {
    if (!canCreate) return;
    const requestedId = createId("relationship");
    const relationshipId = addRelationship(
      sourceEntityId,
      targetEntityId,
      requestedId,
      sourceAttributeId || null,
      targetAttributeId || null,
      { name, kind, sourceCardinality, targetCardinality },
    );
    if (!relationshipId) return;
    ensureEntityVisible(sourceEntityId, activeDiagramId);
    ensureEntityVisible(targetEntityId, activeDiagramId);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="relationship-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relationship-dialog-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Logical model</span>
            <h2 id="relationship-dialog-title">Create relationship</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close relationship dialog"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>
        <div className="relationship-dialog-body">
          {entities.length < 1 ? (
            <div className="dialog-empty-state">
              <Link2 size={22} />
              <strong>Add an entity first</strong>
              <span>An association can also be recursive on one entity.</span>
            </div>
          ) : (
            <>
              <div className="relationship-dialog-basics">
                <label>
                  Relationship type
                  <select
                    className="select-field"
                    value={kind}
                    onChange={(event) => {
                      const nextKind = event.target.value as RelationshipKind;
                      setKind(nextKind);
                      if (nextKind === "inheritance") {
                        setSourceAttributeId("");
                        setTargetAttributeId("");
                      }
                    }}
                  >
                    <option value="association">Association</option>
                    <option value="inheritance">Subtype / supertype</option>
                  </select>
                </label>
              </div>
              <label className="field-label" htmlFor="new-relationship-name">
                Optional label
              </label>
              <input
                id="new-relationship-name"
                className="text-field"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. places, contains, belongs to"
              />
              {kind === "inheritance" && (
                <p className="dialog-inline-note">
                  Source is the subtype; target is the supertype. Recursive inheritance
                  is not allowed.
                </p>
              )}
              <div className="relationship-dialog-ends">
                <EndpointFields
                  label="Source"
                  entities={entities}
                  entityId={sourceEntityId}
                  attributeId={sourceAttributeId}
                  cardinality={sourceCardinality}
                  showMapping={kind === "association"}
                  onEntityChange={(value) => {
                    setSourceEntityId(value);
                    setSourceAttributeId("");
                  }}
                  onAttributeChange={setSourceAttributeId}
                  onCardinalityChange={setSourceCardinality}
                />
                <div className="relationship-dialog-connector" aria-hidden="true">
                  <span />
                  <Link2 size={14} />
                  <span />
                </div>
                <EndpointFields
                  label="Target"
                  entities={entities}
                  entityId={targetEntityId}
                  attributeId={targetAttributeId}
                  cardinality={targetCardinality}
                  showMapping={kind === "association"}
                  onEntityChange={(value) => {
                    setTargetEntityId(value);
                    setTargetAttributeId("");
                  }}
                  onAttributeChange={setTargetAttributeId}
                  onCardinalityChange={setTargetCardinality}
                />
              </div>
              <div className="relationship-dialog-summary">
                <strong>{source?.name || "Source"}</strong>
                <span>will relate to</span>
                <strong>{target?.name || "Target"}</strong>
              </div>
            </>
          )}
        </div>
        <footer className="export-dialog-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!canCreate}
            onClick={createRelationship}
          >
            <Plus size={15} /> Create relationship
          </button>
        </footer>
      </section>
    </div>
  );
}

interface EndpointFieldsProps {
  label: string;
  entities: Array<{
    id: string;
    name: string;
    attributes: Array<{ id: string; name: string }>;
  }>;
  entityId: string;
  attributeId: string;
  cardinality: Cardinality;
  showMapping: boolean;
  onEntityChange: (value: string) => void;
  onAttributeChange: (value: string) => void;
  onCardinalityChange: (value: Cardinality) => void;
}

function EndpointFields({
  label,
  entities,
  entityId,
  attributeId,
  cardinality,
  showMapping,
  onEntityChange,
  onAttributeChange,
  onCardinalityChange,
}: EndpointFieldsProps) {
  const entity = entities.find((candidate) => candidate.id === entityId);
  return (
    <fieldset className="endpoint-fields">
      <legend>{label}</legend>
      <label>
        Entity
        <select
          className="select-field"
          value={entityId}
          onChange={(event) => onEntityChange(event.target.value)}
        >
          {entities.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name || "Untitled entity"}
            </option>
          ))}
        </select>
      </label>
      {showMapping && (
        <>
          <label>
            Attribute
            <select
              className="select-field"
              value={attributeId}
              onChange={(event) => onAttributeChange(event.target.value)}
            >
              <option value="">Entity boundary</option>
              {entity?.attributes.map((attribute) => (
                <option key={attribute.id} value={attribute.id}>
                  {attribute.name || "Untitled attribute"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cardinality
            <select
              className="select-field"
              value={cardinality}
              onChange={(event) =>
                onCardinalityChange(event.target.value as Cardinality)
              }
            >
              {CARDINALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.shortLabel})
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </fieldset>
  );
}
