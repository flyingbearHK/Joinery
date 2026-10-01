import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { exportDrawioFile, importDrawioFile } from "../domain/drawio";
import {
  exportMermaidDiagram,
  parseMermaidDiagram,
  type ModelImportResult,
} from "../domain/mermaid";
import type { DiagramId, JoineryProject } from "../domain/model";
import type { OpenedProjectFile } from "./documentIO";

export type ModelFormat = "mmd" | "drawio";

const IMPORT_EXTENSIONS = ["mmd", "mermaid", "drawio", "xml", "txt"];

const FORMAT_LABELS: Record<ModelFormat, string> = {
  mmd: "Mermaid diagram",
  drawio: "drawio diagram",
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
      .slice(0, 120) || "Joinery model"
  );
}

function openInBrowser(): Promise<OpenedProjectFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMPORT_EXTENSIONS.map((extension) => `.${extension}`).join(",");
    input.style.display = "none";

    const finish = (result: OpenedProjectFile | null) => {
      input.remove();
      resolve(result);
    };

    input.addEventListener(
      "change",
      async () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }
        try {
          finish({ path: file.name, contents: await file.text() });
        } catch {
          finish(null);
        }
      },
      { once: true },
    );

    // Browsers do not reliably emit `change` when the picker is cancelled.
    window.addEventListener(
      "focus",
      () => {
        window.setTimeout(() => {
          if (!input.files?.length && input.isConnected) finish(null);
        }, 300);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}

export async function chooseAndReadModelFile(): Promise<OpenedProjectFile | null> {
  if (!isTauri()) return openInBrowser();

  const selected = await open({
    title: "Import model",
    multiple: false,
    directory: false,
    filters: [
      { name: "Model files", extensions: IMPORT_EXTENSIONS },
      { name: "Mermaid", extensions: ["mmd", "mermaid"] },
      { name: "drawio", extensions: ["drawio", "xml"] },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;

  const contents = await invoke<string>("read_text_file", { path: selected });
  return { path: selected, contents };
}

export function fileNameStem(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Detects the import format from the file extension, then the contents. */
export function detectModelFormat(path: string, contents: string): ModelFormat | null {
  const extension = fileNameStem(path)
    ? path.slice(fileNameStem(path).length + 1).toLowerCase()
    : "";
  if (extension === "mmd" || extension === "mermaid") return "mmd";
  if (extension === "drawio" || extension === "xml") return "drawio";
  if (/<\s*mxfile|<\s*mxGraphModel/.test(contents)) return "drawio";
  if (/(^|\n)\s*erDiagram\b/i.test(contents)) return "mmd";
  return null;
}

export async function importModelFile(
  path: string,
  contents: string,
): Promise<ModelImportResult> {
  const name = fileNameStem(path) || "Imported model";
  const format = detectModelFormat(path, contents);
  if (format === "mmd") return parseMermaidDiagram(contents, name);
  if (format === "drawio") return importDrawioFile(contents, name);
  throw new Error("The file does not look like a Mermaid erDiagram or a drawio file.");
}

export function renderModelExport(
  project: JoineryProject,
  diagramId: DiagramId,
  format: ModelFormat,
): string {
  return format === "mmd"
    ? exportMermaidDiagram(project, diagramId)
    : exportDrawioFile(project);
}

export async function chooseModelExportPath(
  projectName: string,
  diagramName: string,
  format: ModelFormat,
): Promise<string | null> {
  const base =
    format === "mmd"
      ? `${safeFileStem(projectName)} — ${safeFileStem(diagramName)}`
      : safeFileStem(projectName);
  const defaultName = `${base}.${format}`;
  const suffix = `.${format}`;

  const withExtension = (filePath: string) =>
    filePath.toLocaleLowerCase().endsWith(suffix) ? filePath : `${filePath}${suffix}`;

  if (!isTauri()) {
    const chosen = window.prompt(`Export ${FORMAT_LABELS[format]} as`, defaultName);
    return chosen ? withExtension(chosen.trim()) : null;
  }

  const selected = await save({
    title: `Export ${FORMAT_LABELS[format]}`,
    defaultPath: defaultName,
    canCreateDirectories: true,
    filters: [{ name: FORMAT_LABELS[format], extensions: [format] }],
  });
  return selected ? withExtension(selected) : null;
}

export async function writeModelFile(
  filePath: string,
  contents: string,
): Promise<void> {
  if (isTauri()) {
    await invoke("write_text_file_atomic", { path: filePath, contents });
    return;
  }
  const fileName = filePath.split(/[\\/]/).pop() || "Joinery model";
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
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
