import { FileSpreadsheet, FileText, X } from "lucide-react";
import { createModelCsv, createModelHtmlReport } from "../domain/report";
import { saveModelReport, type ReportFormat } from "../native/reportIO";
import { useProjectStore } from "../state/projectStore";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  onNotice: (notice: { kind: "success" | "error"; message: string }) => void;
}

export function ReportDialog({ open, onClose, onNotice }: ReportDialogProps) {
  const project = useProjectStore((state) => state.project);
  if (!open) return null;

  const exportReport = async (format: ReportFormat) => {
    try {
      const contents =
        format === "html" ? createModelHtmlReport(project) : createModelCsv(project);
      if (await saveModelReport(project.name, format, contents)) {
        onNotice({
          kind: "success",
          message:
            format === "html"
              ? "HTML model report exported."
              : "CSV data dictionary exported.",
        });
        onClose();
      }
    } catch (error) {
      onNotice({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Could not export the report.",
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
        className="report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Documentation</span>
            <h2 id="report-title">Export model report</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close report dialog"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>
        <div className="report-options">
          <button type="button" onClick={() => void exportReport("html")}>
            <FileText size={22} />
            <span>
              <strong>HTML data model report</strong>
              <small>
                Entities, attributes, identifiers, and relationships in a printable
                document.
              </small>
            </span>
          </button>
          <button type="button" onClick={() => void exportReport("csv")}>
            <FileSpreadsheet size={22} />
            <span>
              <strong>CSV data dictionary</strong>
              <small>
                Flat entity and attribute catalog for analysis in a spreadsheet.
              </small>
            </span>
          </button>
        </div>
        <footer className="export-dialog-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </section>
    </div>
  );
}
