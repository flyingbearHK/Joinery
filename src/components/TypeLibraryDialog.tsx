import { Plus, Trash2, X } from "lucide-react";
import { COMMON_LOGICAL_TYPES } from "../domain/model";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";

interface TypeLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TypeLibraryDialog({ open, onClose }: TypeLibraryDialogProps) {
  const logicalTypes = useProjectStore((state) => state.project.model.logicalTypes);
  const addLogicalType = useProjectStore((state) => state.addLogicalType);
  const updateLogicalType = useProjectStore((state) => state.updateLogicalType);
  const deleteLogicalType = useProjectStore((state) => state.deleteLogicalType);
  const confirm = useUiStore((state) => state.confirm);
  if (!open) return null;

  const types = Object.values(logicalTypes).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="type-library-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="type-library-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Model dictionary</span>
            <h2 id="type-library-title">Logical type library</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close type library"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>
        <div className="type-library-body">
          <p>
            Reusable logical types keep terminology and meaning consistent without
            introducing database-specific storage details.
          </p>
          <div className="type-library-heading">
            <strong>{types.length} custom types</strong>
            <button
              type="button"
              className="small-button"
              onClick={() => addLogicalType()}
            >
              <Plus size={13} /> Add type
            </button>
          </div>
          <div className="type-library-list">
            {types.map((logicalType) => (
              <article className="type-editor" key={logicalType.id}>
                <div className="type-editor-grid">
                  <label>
                    Name
                    <input
                      className="text-field"
                      value={logicalType.name}
                      onChange={(event) =>
                        updateLogicalType(logicalType.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Base type
                    <select
                      className="select-field"
                      value={logicalType.baseType}
                      onChange={(event) =>
                        updateLogicalType(logicalType.id, {
                          baseType: event.target.value,
                        })
                      }
                    >
                      {COMMON_LOGICAL_TYPES.map((baseType) => (
                        <option key={baseType} value={baseType}>
                          {baseType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Display format
                    <input
                      className="text-field"
                      value={logicalType.format}
                      placeholder="Optional, e.g. 0.00"
                      onChange={(event) =>
                        updateLogicalType(logicalType.id, {
                          format: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${logicalType.name}`}
                    onClick={async () => {
                      const accepted = await confirm({
                        title: "Delete logical type?",
                        message:
                          "Existing attributes keep their current type name, but this reusable definition will be removed.",
                        confirmLabel: "Delete type",
                        destructive: true,
                      });
                      if (accepted) deleteLogicalType(logicalType.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  className="text-field textarea"
                  rows={2}
                  value={logicalType.description}
                  placeholder="Business meaning and usage"
                  aria-label={`${logicalType.name} description`}
                  onChange={(event) =>
                    updateLogicalType(logicalType.id, {
                      description: event.target.value,
                    })
                  }
                />
              </article>
            ))}
            {types.length === 0 && (
              <button
                type="button"
                className="empty-attributes"
                onClick={() => addLogicalType()}
              >
                <Plus size={15} /> Add the first reusable logical type
              </button>
            )}
          </div>
        </div>
        <footer className="export-dialog-footer">
          <button type="button" className="button button-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
