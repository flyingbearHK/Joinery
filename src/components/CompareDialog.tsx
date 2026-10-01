import { useState } from "react";
import {
  CheckCircle2,
  FileSearch,
  GitMerge,
  Plus,
  Minus,
  RefreshCw,
  X,
} from "lucide-react";
import { compareProjects, type ModelDifference } from "../domain/compare";
import { deserializeProject } from "../domain/document";
import type { JoineryProject } from "../domain/model";
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
  const applyComparisonMerge = useProjectStore((state) => state.applyComparisonMerge);
  const [fileName, setFileName] = useState<string | null>(null);
  const [comparison, setComparison] = useState<JoineryProject | null>(null);
  const [differences, setDifferences] = useState<ModelDifference[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeletions, setConfirmDeletions] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const selectComparison = async () => {
    setBusy(true);
    try {
      const opened = await chooseAndReadProject();
      if (!opened) return;
      const comparisonProject = deserializeProject(opened.contents);
      setFileName(opened.path.split(/[\\/]/).pop() ?? opened.path);
      setComparison(comparisonProject);
      const diffs = compareProjects(project, comparisonProject);
      setDifferences(diffs);
      setSelected(new Set(diffs.map((difference) => difference.id)));
      setConfirmDeletions(false);
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

  const selectedDifferences =
    differences?.filter((difference) => selected.has(difference.id)) ?? [];
  const selectedRemovals = selectedDifferences.filter(
    (difference) => difference.kind === "removed",
  ).length;

  const applyMerge = () => {
    if (!comparison || selectedDifferences.length === 0) return;
    if (selectedRemovals > 0 && !confirmDeletions) {
      setConfirmDeletions(true);
      return;
    }
    const result = applyComparisonMerge(comparison, selectedDifferences);
    setConfirmDeletions(false);
    if (result.applied > 0) {
      setDifferences(compareProjects(result.project, comparison));
      setSelected(new Set());
      onNotice({
        kind: "success",
        message: `Merged ${result.applied} change${result.applied === 1 ? "" : "s"}.${
          result.skipped.length ? ` ${result.skipped.length} could not be applied.` : ""
        }`,
      });
    } else {
      onNotice({
        kind: "error",
        message: result.skipped[0]?.reason ?? "No selected changes could be applied.",
      });
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
        {differences !== null && differences.length > 0 && (
          <div className="compare-selection-bar">
            <label className="check-row">
              <input
                type="checkbox"
                aria-label="Select all differences"
                checked={selected.size === differences.length}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? new Set(differences.map((difference) => difference.id))
                      : new Set(),
                  )
                }
              />
              <span>
                {selected.size} of {differences.length} selected
              </span>
            </label>
          </div>
        )}
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
                  <input
                    type="checkbox"
                    aria-label={`Select: ${difference.title}`}
                    checked={selected.has(difference.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(difference.id)) next.delete(difference.id);
                      else next.add(difference.id);
                      setSelected(next);
                      setConfirmDeletions(false);
                    }}
                  />
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
        {confirmDeletions && (
          <div className="merge-confirm" role="alert">
            <span>
              Merging includes {selectedRemovals} deletion
              {selectedRemovals === 1 ? "" : "s"} — objects will be removed from the
              current model.
            </span>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setConfirmDeletions(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={applyMerge}
            >
              Confirm merge
            </button>
          </div>
        )}
        <footer className="export-dialog-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Done
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!comparison || selectedDifferences.length === 0}
            onClick={applyMerge}
          >
            <GitMerge size={14} /> Merge {selectedDifferences.length || ""} selected
          </button>
        </footer>
      </section>
    </div>
  );
}
