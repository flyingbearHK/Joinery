import { useState } from "react";
import { CheckCircle2, FileSearch, Plus, Minus, RefreshCw, X } from "lucide-react";
import { compareProjects, type ModelDifference } from "../domain/compare";
import { deserializeProject } from "../domain/document";
import { chooseAndReadProject } from "../native/documentIO";
import { useProjectStore } from "../state/projectStore";

interface CompareDialogProps {
  open: boolean;
  onClose: () => void;
  onNotice: (notice: { kind: "success" | "error"; message: string }) => void;
}

const icons = { added: Plus, removed: Minus, changed: RefreshCw };

export function CompareDialog({ open, onClose, onNotice }: CompareDialogProps) {
  const project = useProjectStore((state) => state.project);
  const [fileName, setFileName] = useState<string | null>(null);
  const [differences, setDifferences] = useState<ModelDifference[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const selectComparison = async () => {
    setBusy(true);
    try {
      const opened = await chooseAndReadProject();
      if (!opened) return;
      const comparison = deserializeProject(opened.contents);
      setFileName(opened.path.split(/[\\/]/).pop() ?? opened.path);
      setDifferences(compareProjects(project, comparison));
    } catch (error) {
      onNotice({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Could not compare the model.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Model review</span>
            <h2 id="compare-title">Compare logical models</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close comparison"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>
        <div className="compare-toolbar">
          <div>
            <strong>{project.name}</strong>
            <span>Current model</span>
          </div>
          <span>versus</span>
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={() => void selectComparison()}
          >
            <FileSearch size={14} /> {fileName ?? "Choose .joinery file"}
          </button>
        </div>
        <div className="comparison-list">
          {differences === null ? (
            <div className="validation-empty">
              <FileSearch size={27} />
              <strong>Select another model</strong>
              <span>
                Joinery compares objects by logical names rather than internal IDs.
              </span>
            </div>
          ) : differences.length === 0 ? (
            <div className="validation-empty">
              <CheckCircle2 size={27} />
              <strong>No logical differences</strong>
              <span>
                The compared model has equivalent entities, attributes, and
                relationships.
              </span>
            </div>
          ) : (
            differences.map((difference) => {
              const Icon = icons[difference.kind];
              return (
                <article
                  className={`comparison-item comparison-${difference.kind}`}
                  key={difference.id}
                >
                  <Icon size={14} />
                  <span>
                    <strong>{difference.title}</strong>
                    <small>{difference.detail}</small>
                  </span>
                  <em>{difference.category}</em>
                </article>
              );
            })
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
