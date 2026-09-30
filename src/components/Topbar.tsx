import {
  Boxes,
  Check,
  Download,
  FilePlus2,
  FileText,
  GitCompareArrows,
  FolderOpen,
  Library,
  Link2,
  LoaderCircle,
  LogOut,
  Moon,
  Plus,
  Save,
  Redo2,
  SaveAll,
  Settings,
  ShieldCheck,
  SquareDashed,
  Sparkles,
  StickyNote,
  Sun,
  Undo2,
} from "lucide-react";
import type { DocumentActivity } from "../state/documentStore";
import type { Theme } from "../state/uiStore";
import { fileNameFromPath } from "../state/documentStore";

interface TopbarProps {
  projectName: string;
  filePath: string | null;
  isDirty: boolean;
  documentActivity: DocumentActivity;
  isArranging: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onValidate: () => void;
  onManageTypes: () => void;
  onExportReport: () => void;
  onCompare: () => void;
  onOpenSettings: () => void;
  onSaveProjectAs: () => void;
  onQuit: () => void;
  onExport: () => void;
  onAddRelationship: () => void;
  onAddNote: () => void;
  onAddSubjectArea: () => void;
  onAddEntity: () => void;
  onAutoLayout: () => void;
}

function documentStatus(
  activity: DocumentActivity,
  isDirty: boolean,
  filePath: string | null,
): { label: string; busy: boolean; saved: boolean } {
  if (activity === "opening") return { label: "Opening…", busy: true, saved: false };
  if (activity === "saving") return { label: "Saving…", busy: true, saved: false };
  if (activity === "recovering") {
    return { label: "Checking recovery…", busy: true, saved: false };
  }
  if (isDirty) return { label: "Unsaved changes", busy: false, saved: false };
  const fileName = fileNameFromPath(filePath);
  return {
    label: fileName ? `${fileName} · Saved` : "Not saved yet",
    busy: false,
    saved: Boolean(fileName),
  };
}

export function Topbar({
  projectName,
  filePath,
  isDirty,
  documentActivity,
  isArranging,
  theme,
  onToggleTheme,
  onNewProject,
  onOpenProject,
  onSaveProject,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onValidate,
  onManageTypes,
  onExportReport,
  onCompare,
  onOpenSettings,
  onSaveProjectAs,
  onQuit,
  onExport,
  onAddRelationship,
  onAddNote,
  onAddSubjectArea,
  onAddEntity,
  onAutoLayout,
}: TopbarProps) {
  const status = documentStatus(documentActivity, isDirty, filePath);
  const fileActionsDisabled = status.busy;

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Boxes size={19} strokeWidth={1.8} />
          </div>
          <div className="brand-copy">
            <div className="brand-name">Joinery</div>
            <div className="brand-tagline">Fit your data together</div>
            <div className="brand-signature">
              <span>BY FLYINGBEAR</span>
              <span>v{__APP_VERSION__}</span>
            </div>
          </div>
        </div>
        <div className="topbar-divider" />
        <nav className="file-actions" aria-label="Project file actions">
          <button
            type="button"
            className="topbar-icon-button"
            title="New project (⌘N)"
            aria-label="New project"
            disabled={fileActionsDisabled}
            onClick={onNewProject}
          >
            <FilePlus2 size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Open project (⌘O)"
            aria-label="Open project"
            disabled={fileActionsDisabled}
            onClick={onOpenProject}
          >
            <FolderOpen size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Save project (⌘S)"
            aria-label="Save project"
            disabled={fileActionsDisabled}
            onClick={onSaveProject}
          >
            <Save size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Save project as (⇧⌘S)"
            aria-label="Save project as"
            disabled={fileActionsDisabled}
            onClick={onSaveProjectAs}
          >
            <SaveAll size={15} />
          </button>
          <span className="file-action-divider" />
          <button
            type="button"
            className="topbar-icon-button"
            title="Undo (⌘Z)"
            aria-label="Undo"
            disabled={!canUndo || fileActionsDisabled}
            onClick={onUndo}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Redo (⇧⌘Z)"
            aria-label="Redo"
            disabled={!canRedo || fileActionsDisabled}
            onClick={onRedo}
          >
            <Redo2 size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Logical type library"
            aria-label="Logical type library"
            onClick={onManageTypes}
          >
            <Library size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Export model report"
            aria-label="Export model report"
            onClick={onExportReport}
          >
            <FileText size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Compare model"
            aria-label="Compare model"
            onClick={onCompare}
          >
            <GitCompareArrows size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Validate model"
            aria-label="Validate model"
            onClick={onValidate}
          >
            <ShieldCheck size={15} />
          </button>
          <span className="file-action-divider" />
          <button
            type="button"
            className="topbar-icon-button"
            title="Settings and updates"
            aria-label="Settings and updates"
            onClick={onOpenSettings}
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title={`Use ${theme === "light" ? "dark" : "light"} theme`}
            aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}
            onClick={onToggleTheme}
          >
            {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button
            type="button"
            className="topbar-icon-button"
            title="Quit Joinery (⌘Q)"
            aria-label="Quit Joinery"
            disabled={fileActionsDisabled}
            onClick={onQuit}
          >
            <LogOut size={15} />
          </button>
        </nav>
      </div>

      <div className="project-heading" title={filePath ?? undefined}>
        <span className="project-name">{projectName}</span>
        <span className={`save-state ${isDirty ? "unsaved" : ""}`}>
          {status.busy ? (
            <LoaderCircle size={11} className="spin" />
          ) : status.saved ? (
            <Check size={12} />
          ) : (
            <span className="dirty-dot" />
          )}
          {status.label}
        </span>
      </div>

      <nav className="topbar-actions" aria-label="Diagram actions">
        <button
          type="button"
          className="button button-secondary button-icon-label"
          onClick={onExport}
        >
          <Download size={15} />
          Export
        </button>
        <button
          type="button"
          className="topbar-icon-button"
          title="Add note"
          aria-label="Add note"
          onClick={onAddNote}
        >
          <StickyNote size={15} />
        </button>
        <button
          type="button"
          className="topbar-icon-button"
          title="Add subject area"
          aria-label="Add subject area"
          onClick={onAddSubjectArea}
        >
          <SquareDashed size={15} />
        </button>
        <button
          type="button"
          className="button button-secondary button-icon-label"
          onClick={onAddRelationship}
        >
          <Link2 size={15} />
          Relationship
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onAutoLayout}
          disabled={isArranging}
        >
          <Sparkles size={15} className={isArranging ? "spin" : ""} />
          {isArranging ? "Arranging…" : "Auto arrange"}
        </button>
        <button type="button" className="button button-primary" onClick={onAddEntity}>
          <Plus size={16} />
          Entity
        </button>
      </nav>
    </header>
  );
}
