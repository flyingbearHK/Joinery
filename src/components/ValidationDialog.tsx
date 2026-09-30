import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { validateLogicalModel, type ValidationSeverity } from "../domain/validation";
import { useProjectStore } from "../state/projectStore";

interface ValidationDialogProps {
  open: boolean;
  onClose: () => void;
}

const icons = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<ValidationSeverity, typeof Info>;

export function ValidationDialog({ open, onClose }: ValidationDialogProps) {
  const project = useProjectStore((state) => state.project);
  const activeDiagramId = useProjectStore((state) => state.activeDiagramId);
  const setSelection = useProjectStore((state) => state.setSelection);
  const ensureEntityVisible = useProjectStore((state) => state.ensureEntityVisible);
  if (!open) return null;

  const issues = validateLogicalModel(project);
  const counts = {
    error: issues.filter((issue) => issue.severity === "error").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="validation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Model quality</span>
            <h2 id="validation-title">Validation results</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close validation"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>
        <div className="validation-summary">
          <span className="validation-error">
            <AlertCircle size={13} /> {counts.error} errors
          </span>
          <span className="validation-warning">
            <AlertTriangle size={13} /> {counts.warning} warnings
          </span>
          <span className="validation-info">
            <Info size={13} /> {counts.info} suggestions
          </span>
        </div>
        <div className="validation-list">
          {issues.map((issue) => {
            const Icon = icons[issue.severity];
            return (
              <button
                type="button"
                className={`validation-issue validation-${issue.severity}`}
                key={issue.id}
                onClick={() => {
                  if (issue.selection?.kind === "entity") {
                    ensureEntityVisible(issue.selection.id, activeDiagramId);
                  } else if (issue.selection?.kind === "relationship") {
                    const relationship =
                      project.model.relationships[issue.selection.id];
                    if (relationship) {
                      ensureEntityVisible(relationship.sourceEntityId, activeDiagramId);
                      ensureEntityVisible(relationship.targetEntityId, activeDiagramId);
                    }
                  }
                  setSelection(issue.selection);
                  onClose();
                }}
              >
                <Icon size={15} />
                <span>
                  <strong>{issue.title}</strong>
                  <small>{issue.detail}</small>
                </span>
              </button>
            );
          })}
          {issues.length === 0 && (
            <div className="validation-empty">
              <CheckCircle2 size={26} />
              <strong>No issues found</strong>
              <span>The logical model passes all current validation rules.</span>
            </div>
          )}
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
