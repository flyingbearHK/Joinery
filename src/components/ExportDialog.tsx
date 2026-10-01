import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileCode,
  FileImage,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Waypoints,
  X,
} from "lucide-react";
import type { ExportBackground } from "../diagram/exportSvg";
import type { ExportFormat, PdfPageMode } from "../native/exportIO";
import type { ModelFormat } from "../native/modelIO";

export type AnyExportFormat = ExportFormat | ModelFormat;

export interface ExportOptions {
  format: AnyExportFormat;
  background: ExportBackground;
  pngScale: number;
  pdfPageMode: PdfPageMode;
}

interface ExportDialogProps {
  open: boolean;
  busy: boolean;
  diagramName: string;
  dimensions: { width: number; height: number } | null;
  previews: { white: string; transparent: string } | null;
  modelPreviews: { mmd: string; drawio: string } | null;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

const formats: Array<{
  value: AnyExportFormat;
  title: string;
  detail: string;
  icon: typeof ImageIcon;
}> = [
  { value: "svg", title: "SVG", detail: "Scalable vector", icon: ImageIcon },
  { value: "png", title: "PNG", detail: "High-resolution image", icon: FileImage },
  { value: "pdf", title: "PDF", detail: "One vector page", icon: FileText },
  {
    value: "mmd",
    title: "Mermaid",
    detail: "erDiagram for docs and GitHub",
    icon: FileCode,
  },
  {
    value: "drawio",
    title: "drawio",
    detail: "Editable XML diagram",
    icon: Waypoints,
  },
];

const FORMAT_TITLES: Record<AnyExportFormat, string> = {
  svg: "SVG",
  png: "PNG",
  pdf: "PDF",
  mmd: "Mermaid",
  drawio: "drawio",
};

const FORMAT_NOTES: Record<AnyExportFormat, string> = {
  svg: "SVG is ideal for documentation and remains sharp at any size.",
  png: "PNG is rendered from the same vector source for consistent output.",
  pdf: "PDF output remains vector-based and uses one page sized to the diagram contents.",
  mmd: "Mermaid erDiagram text of the current diagram; paste it into docs, wikis, or GitHub markdown.",
  drawio:
    "A drawio file with one page per diagram, preserving positions and Crow's Foot markers.",
};

export function ExportDialog({
  open,
  busy,
  diagramName,
  dimensions,
  previews,
  modelPreviews,
  onClose,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState<AnyExportFormat>("png");
  const [background, setBackground] = useState<ExportBackground>("white");
  const [pngScale, setPngScale] = useState(2);
  const [pdfPageMode, setPdfPageMode] = useState<PdfPageMode>("content");
  const exportButton = useRef<HTMLButtonElement>(null);
  const isModelFormat = format === "mmd" || format === "drawio";
  const previewUrl =
    open && previews && !isModelFormat
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previews[background])}`
      : null;
  const textPreview =
    open && isModelFormat && modelPreviews ? modelPreviews[format] : null;

  useEffect(() => {
    if (!open) return;
    exportButton.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const outputWidth = Math.round((dimensions?.width ?? 0) * pngScale);
  const outputHeight = Math.round((dimensions?.height ?? 0) * pngScale);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Current diagram</span>
            <h2 id="export-title">Export {diagramName}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close export dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>

        <div className="export-dialog-body">
          {isModelFormat ? (
            <pre
              className="export-text-preview"
              aria-label={`${FORMAT_TITLES[format]} preview`}
            >
              {textPreview ?? ""}
            </pre>
          ) : (
            <div
              className={`export-preview ${
                background === "transparent" ? "transparent" : ""
              }`}
            >
              {previewUrl && (
                <img src={previewUrl} alt={`${diagramName} export preview`} />
              )}
              {dimensions && (
                <span>
                  {dimensions.width.toLocaleString()} ×{" "}
                  {dimensions.height.toLocaleString()} px
                </span>
              )}
            </div>
          )}

          <div className="export-field-group">
            <span className="export-label">Format</span>
            <div className="format-options">
              {formats.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    type="button"
                    className={`format-option ${
                      format === option.value ? "selected" : ""
                    }`}
                    key={option.value}
                    onClick={() => setFormat(option.value)}
                  >
                    <Icon size={17} />
                    <strong>{option.title}</strong>
                    <span>{option.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {!isModelFormat && (
            <div className="export-field-group export-inline-group">
              <div>
                <span className="export-label">Background</span>
                <p>Choose a white page or preserve transparency.</p>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={background === "white" ? "selected" : ""}
                  onClick={() => setBackground("white")}
                >
                  White
                </button>
                <button
                  type="button"
                  className={background === "transparent" ? "selected" : ""}
                  onClick={() => setBackground("transparent")}
                >
                  Transparent
                </button>
              </div>
            </div>
          )}

          {format === "pdf" && (
            <div className="export-field-group export-inline-group">
              <div>
                <span className="export-label">Page layout</span>
                <p>Fit to one page or tile large diagrams for printing.</p>
              </div>
              <select
                className="select-field export-page-select"
                value={pdfPageMode}
                aria-label="PDF page layout"
                onChange={(event) => setPdfPageMode(event.target.value as PdfPageMode)}
              >
                <option value="content">Size page to content</option>
                <option value="a4-portrait">A4 portrait</option>
                <option value="a4-landscape">A4 landscape</option>
                <option value="a3-portrait">A3 portrait</option>
                <option value="a3-landscape">A3 landscape</option>
                <option value="tile-a4-landscape">
                  Tile across A4 landscape pages
                </option>
              </select>
            </div>
          )}

          {format === "png" && (
            <div className="export-field-group export-inline-group">
              <div>
                <span className="export-label">Resolution</span>
                <p>
                  {dimensions
                    ? `${outputWidth.toLocaleString()} × ${outputHeight.toLocaleString()} px`
                    : "Calculated from the diagram bounds"}
                </p>
              </div>
              <div className="segmented-control scale-control">
                {[1, 2, 3].map((scale) => (
                  <button
                    type="button"
                    className={pngScale === scale ? "selected" : ""}
                    key={scale}
                    onClick={() => setPngScale(scale)}
                  >
                    {scale}×
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="export-note">{FORMAT_NOTES[format]}</div>
        </div>

        <footer className="export-dialog-footer">
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            ref={exportButton}
            type="button"
            className="button button-primary export-submit"
            disabled={busy}
            onClick={() => onExport({ format, background, pngScale, pdfPageMode })}
          >
            {busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Download size={15} />
            )}
            {busy ? "Exporting…" : `Export ${FORMAT_TITLES[format]}`}
          </button>
        </footer>
      </section>
    </div>
  );
}
