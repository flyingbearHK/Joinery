import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { SvgExportResult } from "../diagram/exportSvg";

export type ExportFormat = "svg" | "png" | "pdf";
export type PdfPageMode =
  | "content"
  | "a4-portrait"
  | "a4-landscape"
  | "a3-portrait"
  | "a3-landscape"
  | "tile-a4-landscape";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  svg: "SVG image",
  png: "PNG image",
  pdf: "PDF document",
};

function safeFileStem(value: string): string {
  return (
    Array.from(value.trim())
      .map((character) =>
        character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
          ? "-"
          : character,
      )
      .join("")
      .replace(/\s+/g, " ")
      .slice(0, 120) || "Joinery diagram"
  );
}

function withExtension(filePath: string, format: ExportFormat): string {
  const suffix = `.${format}`;
  return filePath.toLocaleLowerCase().endsWith(suffix)
    ? filePath
    : `${filePath}${suffix}`;
}

export async function chooseExportPath(
  projectName: string,
  diagramName: string,
  format: ExportFormat,
): Promise<string | null> {
  const defaultName = `${safeFileStem(projectName)} — ${safeFileStem(diagramName)}.${format}`;

  if (!isTauri()) {
    const chosen = window.prompt(`Export ${FORMAT_LABELS[format]} as`, defaultName);
    return chosen ? withExtension(chosen.trim(), format) : null;
  }

  const selected = await save({
    title: `Export ${FORMAT_LABELS[format]}`,
    defaultPath: defaultName,
    canCreateDirectories: true,
    filters: [{ name: FORMAT_LABELS[format], extensions: [format] }],
  });
  return selected ? withExtension(selected, format) : null;
}

function downloadBlob(filePath: string, blob: Blob): void {
  const fileName = filePath.split(/[\\/]/).pop() || `Joinery diagram`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function svgToPngBlob(exported: SvgExportResult, scale: number): Promise<Blob> {
  const svgBlob = new Blob([exported.svg], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(exported.width * scale);
    canvas.height = Math.round(exported.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not create a PNG canvas.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!png) throw new Error("The browser could not encode the PNG image.");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportDiagramFile(
  format: ExportFormat,
  filePath: string,
  exported: SvgExportResult,
  pngScale: number,
  pdfPageMode: PdfPageMode = "content",
): Promise<void> {
  if (isTauri()) {
    if (format === "svg") {
      await invoke("export_svg_file", { path: filePath, svg: exported.svg });
    } else if (format === "png") {
      await invoke("export_png_file", {
        path: filePath,
        svg: exported.svg,
        scale: pngScale,
      });
    } else {
      await invoke("export_pdf_file", {
        path: filePath,
        svg: exported.svg,
        pageMode: pdfPageMode,
      });
    }
    return;
  }

  if (format === "svg") {
    downloadBlob(
      filePath,
      new Blob([exported.svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    return;
  }
  if (format === "png") {
    downloadBlob(filePath, await svgToPngBlob(exported, pngScale));
    return;
  }

  throw new Error("PDF export is available in the Joinery desktop app.");
}
