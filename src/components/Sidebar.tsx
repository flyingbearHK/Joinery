import { useMemo, useState } from "react";
import {
  Box,
  ChevronRight,
  EyeOff,
  LayoutGrid,
  Link2,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { useProjectStore } from "../state/projectStore";

interface SidebarProps {
  onFocusEntity: (entityId: string) => void;
  onManageDiagram: () => void;
}

export function Sidebar({ onFocusEntity, onManageDiagram }: SidebarProps) {
  const [query, setQuery] = useState("");
  const project = useProjectStore((state) => state.project);
  const activeDiagramId = useProjectStore((state) => state.activeDiagramId);
  const selection = useProjectStore((state) => state.selection);
  const setActiveDiagram = useProjectStore((state) => state.setActiveDiagram);
  const setSelection = useProjectStore((state) => state.setSelection);
  const addDiagram = useProjectStore((state) => state.addDiagram);
  const ensureEntityVisible = useProjectStore((state) => state.ensureEntityVisible);

  const activeDiagram = project.diagrams[activeDiagramId];
  const entities = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return Object.values(project.model.entities)
      .filter(
        (entity) =>
          !normalizedQuery ||
          entity.name.toLocaleLowerCase().includes(normalizedQuery) ||
          entity.description.toLocaleLowerCase().includes(normalizedQuery) ||
          entity.attributes.some(
            (attribute) =>
              attribute.name.toLocaleLowerCase().includes(normalizedQuery) ||
              attribute.logicalType.toLocaleLowerCase().includes(normalizedQuery),
          ),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [project.model.entities, query]);
  const visibleRelationships = useMemo(() => {
    const visibleEntityIds = new Set(Object.keys(activeDiagram?.entityViews ?? {}));
    return Object.values(project.model.relationships)
      .filter(
        (relationship) =>
          visibleEntityIds.has(relationship.sourceEntityId) &&
          visibleEntityIds.has(relationship.targetEntityId),
      )
      .sort((left, right) => {
        const leftName = left.name || left.id;
        const rightName = right.name || right.id;
        return leftName.localeCompare(rightName);
      });
  }, [activeDiagram?.entityViews, project.model.relationships]);

  function revealEntity(entityId: string) {
    const wasVisible = Boolean(activeDiagram?.entityViews[entityId]);
    ensureEntityVisible(entityId);
    setSelection({ kind: "entity", id: entityId });
    if (!wasVisible) {
      requestAnimationFrame(() => {
        onFocusEntity(entityId);
        requestAnimationFrame(() => onFocusEntity(entityId));
      });
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <section className="sidebar-section">
          <div className="section-heading">
            <span>Diagrams</span>
            <div className="section-heading-actions">
              <button
                type="button"
                className="icon-button"
                title="Manage active diagram"
                aria-label="Manage active diagram"
                onClick={onManageDiagram}
              >
                <Settings2 size={13} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Add diagram"
                aria-label="Add diagram"
                onClick={() => addDiagram()}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="sidebar-list">
            {Object.values(project.diagrams).map((diagram) => (
              <button
                type="button"
                className={`sidebar-item ${
                  diagram.id === activeDiagramId ? "active" : ""
                }`}
                key={diagram.id}
                onClick={() => setActiveDiagram(diagram.id)}
              >
                <LayoutGrid size={15} />
                <span>{diagram.name}</span>
                <span className="item-count">
                  {Object.keys(diagram.entityViews).length}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-section entity-section">
          <div className="section-heading">
            <span>Entities</span>
            <span className="section-count">
              {Object.keys(project.model.entities).length}
            </span>
          </div>
          <label className="search-field">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find an entity"
              aria-label="Find an entity"
            />
          </label>
          <div className="sidebar-list entity-list">
            {entities.map((entity) => {
              const isVisible = Boolean(activeDiagram?.entityViews[entity.id]);
              const isSelected =
                selection?.kind === "entity" && selection.id === entity.id;
              return (
                <button
                  type="button"
                  className={`sidebar-item entity-item ${isSelected ? "selected" : ""}`}
                  key={entity.id}
                  onClick={() => revealEntity(entity.id)}
                  onDoubleClick={() => onFocusEntity(entity.id)}
                >
                  <Box size={14} />
                  <span>{entity.name || "Untitled entity"}</span>
                  {!isVisible ? (
                    <EyeOff size={12} className="visibility-icon" />
                  ) : (
                    <ChevronRight size={12} className="chevron" />
                  )}
                </button>
              );
            })}
            {entities.length === 0 && (
              <div className="empty-list">No matching entities</div>
            )}
          </div>
        </section>

        <section className="sidebar-section relationship-section">
          <div className="section-heading">
            <span>Relationships</span>
            <span className="section-count">{visibleRelationships.length}</span>
          </div>
          <div className="sidebar-list relationship-list">
            {visibleRelationships.map((relationship) => {
              const source = project.model.entities[relationship.sourceEntityId];
              const target = project.model.entities[relationship.targetEntityId];
              const fallbackName = `${source?.name ?? "Entity"} → ${
                target?.name ?? "Entity"
              }`;
              const isSelected =
                selection?.kind === "relationship" && selection.id === relationship.id;
              return (
                <button
                  type="button"
                  className={`sidebar-item relationship-item ${
                    isSelected ? "selected" : ""
                  }`}
                  key={relationship.id}
                  title={relationship.name || fallbackName}
                  onClick={() =>
                    setSelection({
                      kind: "relationship",
                      id: relationship.id,
                    })
                  }
                >
                  <Link2 size={14} />
                  <span>{relationship.name || fallbackName}</span>
                  <ChevronRight size={12} className="chevron" />
                </button>
              );
            })}
            {visibleRelationships.length === 0 && (
              <div className="empty-list">No relationships on this diagram</div>
            )}
          </div>
        </section>
      </div>

      <div className="sidebar-footer">
        <div className="model-summary">
          <span className="summary-dot" />
          Logical model
        </div>
        <span>Format v{project.formatVersion}</span>
      </div>
    </aside>
  );
}
