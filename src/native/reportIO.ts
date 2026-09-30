import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export type ReportFormat = "html" | "csv";

function download(fileName: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function saveModelReport(
  projectName: string,
  format: ReportFormat,
  contents: string,
): Promise<boolean> {
  const safeName =
    Array.from(projectName.trim())
      .map((character) =>
        character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
          ? "-"
          : character,
      )
      .join("") || "Joinery model";
  const fileName = `${safeName} report.${format}`;

  if (!isTauri()) {
    download(
      fileName,
      contents,
      format === "html" ? "text/html;charset=utf-8" : "text/csv;charset=utf-8",
    );
    return true;
  }

  const path = await save({
    title: `Export ${format.toUpperCase()} model report`,
    defaultPath: fileName,
    filters: [
      {
        name: format === "html" ? "HTML report" : "CSV data dictionary",
        extensions: [format],
      },
    ],
  });
  if (!path) return false;
  await invoke("write_text_file_atomic", { path, contents });
  return true;
}
