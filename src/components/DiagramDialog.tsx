import { Copy, Eye, EyeOff, Trash2, X } from "lucide-react";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";

interface DiagramDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DiagramDialog({ open, onClose }: DiagramDialogProps) {
  const project = useProjectStore((state) => state.project);
  const diagramId = useProjectStore((state) => state.activeDiagramId);
  const updateDiagram = useProjectStore((state) => state.updateDiagram);
  const duplicateDiagram = useProjectStore((state) => state.duplicateDiagram);
  const deleteDiagram = useProjectStore((state) => state.deleteDiagram);
  const setEntityVisibility = useProjectStore((state) => state.setEntityVisibility);
  const setVisibleEntityIds = useProjectStore((state) => state.setVisibleEntityIds);
  const confirm = useUiStore((state) => state.confirm);
  const diagram = project.diagrams[diagramId];
  if (!open || !diagram) return null;

  const entities = Object.values(project.model.entities).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const visibleCount = Object.keys(diagram.entityViews).length;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="diagram-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagram-dialog-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Diagram view</span>
            <h2 id="diagram-dialog-title">Manage {diagram.name}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close diagram settings"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>
        <div className="diagram-dialog-body">
          <section className="diagram-settings-fields">
            <p className="diagram-layout-note">
              Each diagram has its own visibility, positions, and line routes; model
              definitions remain shared.
            </p>
            <label className="field-label" htmlFor="diagram-name">
              Name
            </label>
            <input
              id="diagram-name"
              className="text-field"
              value={diagram.name}
              onChange={(event) =>
                updateDiagram(diagram.id, { name: event.target.value })
              }
            />
            <label className="field-label" htmlFor="diagram-description">
              Description
            </label>
            <textarea
              id="diagram-description"
              className="text-field textarea"
              value={diagram.description}
              rows={3}
              onChange={(event) =>
                updateDiagram(diagram.id, { description: event.target.value })
              }
              placeholder="Purpose or subject area for this view"
            />
          </section>
          <section className="visibility-manager">
            <div className="visibility-heading">
              <div>
                <span className="eyebrow">Contents</span>
                <h3>Entity visibility</h3>
              </div>
              <span>{visibleCount} visible</span>
            </div>
            <div className="visibility-bulk-actions">
              <button
                type="button"
                onClick={() =>
                  setVisibleEntityIds(
                    diagram.id,
                    entities.map((entity) => entity.id),
                  )
                }
              >
                <Eye size={12} /> Show all
              </button>
              <button type="button" onClick={() => setVisibleEntityIds(diagram.id, [])}>
                <EyeOff size={12} /> Hide all
              </button>
            </div>
            <div className="visibility-list">
              {entities.map((entity) => {
                const visible = Boolean(diagram.entityViews[entity.id]);
                return (
                  <label key={entity.id}>
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(event) =>
                        setEntityVisibility(diagram.id, entity.id, event.target.checked)
                      }
                    />
                    <span>{entity.name || "Untitled entity"}</span>
                    {visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </label>
                );
              })}
              {entities.length === 0 && (
                <p className="empty-copy">No entities exist in this model yet.</p>
              )}
            </div>
          </section>
        </div>
        <footer className="diagram-dialog-footer">
          <div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                duplicateDiagram(diagram.id);
                onClose();
              }}
            >
              <Copy size={14} /> Duplicate
            </button>
            <button
              type="button"
              className="button button-danger-quiet"
              disabled={Object.keys(project.diagrams).length <= 1}
              onClick={async () => {
                const accepted = await confirm({
                  title: "Delete diagram?",
                  message:
                    "This removes only the visual view. Entities and relationships remain in the logical model.",
                  confirmLabel: "Delete diagram",
                  destructive: true,
                });
                if (accepted && deleteDiagram(diagram.id)) onClose();
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
          <button type="button" className="button button-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
