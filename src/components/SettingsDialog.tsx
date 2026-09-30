import { useEffect, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, Moon, Sun, X } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onNotice: (notice: { kind: "success" | "info" | "error"; message: string }) => void;
}

export function SettingsDialog({ open, onClose, onNotice }: SettingsDialogProps) {
  const projectSettings = useProjectStore((state) => state.project.settings);
  const updateProjectSettings = useProjectStore((state) => state.updateProjectSettings);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const [version, setVersion] = useState("0.1.0");
  const [checking, setChecking] = useState(false);
  const updatesConfigured = import.meta.env.VITE_JOINERY_UPDATES === "true";

  useEffect(() => {
    if (!open || !isTauri()) return;
    void import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then(setVersion)
      .catch(() => undefined);
  }, [open]);

  if (!open) return null;

  const checkForUpdates = async () => {
    if (!isTauri() || !updatesConfigured) {
      onNotice({
        kind: "info",
        message: "This development build has no update feed configured.",
      });
      return;
    }
    setChecking(true);
    try {
      const [{ check }, { relaunch }] = await Promise.all([
        import("@tauri-apps/plugin-updater"),
        import("@tauri-apps/plugin-process"),
      ]);
      const update = await check();
      if (!update) {
        onNotice({ kind: "success", message: "Joinery is up to date." });
        return;
      }
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      onNotice({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Could not check for updates.",
      });
    } finally {
      setChecking(false);
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
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="export-dialog-header">
          <div>
            <span className="eyebrow">Joinery</span>
            <h2 id="settings-title">Settings & updates</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>
        <div className="settings-body">
          <section>
            <div>
              <strong>Appearance</strong>
              <span>Choose the editor color scheme.</span>
            </div>
            <div className="segmented-control">
              <button
                type="button"
                className={theme === "light" ? "selected" : ""}
                onClick={() => setTheme("light")}
              >
                <Sun size={12} /> Light
              </button>
              <button
                type="button"
                className={theme === "dark" ? "selected" : ""}
                onClick={() => setTheme("dark")}
              >
                <Moon size={12} /> Dark
              </button>
            </div>
          </section>
          <section>
            <div>
              <strong>Naming standard</strong>
              <span>Validate entity and attribute names consistently.</span>
            </div>
            <select
              className="select-field settings-select"
              value={projectSettings.namingConvention}
              aria-label="Naming convention"
              onChange={(event) =>
                updateProjectSettings({
                  namingConvention: event.target
                    .value as typeof projectSettings.namingConvention,
                })
              }
            >
              <option value="none">No enforced convention</option>
              <option value="pascal">PascalCase</option>
              <option value="camel">camelCase</option>
              <option value="snake">snake_case</option>
            </select>
          </section>
          <section>
            <div>
              <strong>Required definitions</strong>
              <span>Warn when entities or attributes lack descriptions.</span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={projectSettings.requireDescriptions}
                onChange={(event) =>
                  updateProjectSettings({
                    requireDescriptions: event.target.checked,
                  })
                }
              />
              <span>{projectSettings.requireDescriptions ? "On" : "Off"}</span>
            </label>
          </section>
          <section>
            <div>
              <strong>Software update</strong>
              <span>Joinery {version}</span>
            </div>
            <button
              type="button"
              className="button button-secondary"
              disabled={checking}
              onClick={() => void checkForUpdates()}
            >
              {checking ? (
                <LoaderCircle size={14} className="spin" />
              ) : updatesConfigured ? (
                <Download size={14} />
              ) : (
                <CheckCircle2 size={14} />
              )}
              {checking ? "Checking…" : "Check for updates"}
            </button>
          </section>
          <section className="settings-about">
            <div>
              <strong>Document format</strong>
              <span>Joinery logical model format v1</span>
            </div>
            <code>.joinery</code>
          </section>
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
