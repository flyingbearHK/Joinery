import { invoke, isTauri } from "@tauri-apps/api/core";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";

const PROJECT_FILTER = [{ name: "Joinery projects", extensions: ["joinery"] }];
const WEB_RECOVERY_KEY = "joinery-recovery-v1";

export interface OpenedProjectFile {
  path: string;
  contents: string;
}

function ensureJoineryExtension(filePath: string): string {
  return filePath.toLocaleLowerCase().endsWith(".joinery")
    ? filePath
    : `${filePath}.joinery`;
}

export function suggestedProjectFileName(projectName: string): string {
  const safeName = Array.from(projectName.trim())
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
        ? "-"
        : character,
    )
    .join("")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return `${safeName || "Untitled model"}.joinery`;
}

async function openInBrowser(): Promise<OpenedProjectFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".joinery,application/json";
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

export async function readProjectAtPath(path: string): Promise<OpenedProjectFile> {
  if (!isTauri()) {
    throw new Error("Opening a project path requires the Joinery desktop app.");
  }
  const contents = await invoke<string>("read_text_file", { path });
  return { path, contents };
}

export async function chooseAndReadProject(): Promise<OpenedProjectFile | null> {
  if (!isTauri()) return openInBrowser();

  const selected = await open({
    title: "Open Joinery project",
    multiple: false,
    directory: false,
    filters: PROJECT_FILTER,
  });
  if (!selected || Array.isArray(selected)) return null;

  return readProjectAtPath(selected);
}

export async function chooseProjectSavePath(
  projectName: string,
  currentPath: string | null,
): Promise<string | null> {
  if (!isTauri()) {
    const suggested = suggestedProjectFileName(projectName);
    const chosen = window.prompt("Save project as", currentPath ?? suggested);
    return chosen ? ensureJoineryExtension(chosen.trim()) : null;
  }

  const selected = await save({
    title: "Save Joinery project",
    defaultPath: currentPath ?? suggestedProjectFileName(projectName),
    canCreateDirectories: true,
    filters: PROJECT_FILTER,
  });
  return selected ? ensureJoineryExtension(selected) : null;
}

function downloadInBrowser(filePath: string, contents: string): void {
  const fileName = filePath.split(/[\\/]/).pop() || "Untitled model.joinery";
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
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

export async function writeProjectFile(
  filePath: string,
  contents: string,
): Promise<void> {
  if (!isTauri()) {
    downloadInBrowser(filePath, contents);
    return;
  }
  await invoke("write_text_file_atomic", { path: filePath, contents });
}

export async function writeRecovery(contents: string): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(WEB_RECOVERY_KEY, contents);
    return;
  }
  await invoke("write_recovery_file", { contents });
}

export async function readRecovery(): Promise<string | null> {
  if (!isTauri()) return localStorage.getItem(WEB_RECOVERY_KEY);
  return invoke<string | null>("read_recovery_file");
}

export async function clearRecovery(): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem(WEB_RECOVERY_KEY);
    return;
  }
  await invoke("clear_recovery_file");
}

export async function confirmDiscardChanges(action: string): Promise<boolean> {
  const detail = `The current project has unsaved changes. Discard them and ${action}?`;
  if (!isTauri()) return window.confirm(detail);
  return ask(detail, {
    title: "Unsaved changes",
    kind: "warning",
    okLabel: "Discard changes",
    cancelLabel: "Cancel",
  });
}

export async function confirmRecovery(savedAt: string): Promise<boolean> {
  const formattedDate = new Date(savedAt).toLocaleString();
  const detail = `Joinery found unsaved work recovered from ${formattedDate}. Would you like to restore it?`;
  if (!isTauri()) return window.confirm(detail);
  return ask(detail, {
    title: "Recover unsaved project",
    kind: "warning",
    okLabel: "Recover",
    cancelLabel: "Discard",
  });
}

export async function showDocumentError(detail: string): Promise<void> {
  if (!isTauri()) return;
  await message(detail, {
    title: "Joinery",
    kind: "error",
    okLabel: "OK",
  });
}
