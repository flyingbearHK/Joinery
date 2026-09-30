import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import "./App.css";
import { CompareDialog } from "./components/CompareDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DiagramDialog } from "./components/DiagramDialog";
import { ExportDialog, type ExportOptions } from "./components/ExportDialog";
import { Inspector } from "./components/Inspector";
import { RelationshipDialog } from "./components/RelationshipDialog";
import { ReportDialog } from "./components/ReportDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { TypeLibraryDialog } from "./components/TypeLibraryDialog";
import { ValidationDialog } from "./components/ValidationDialog";
import { DiagramCanvas, type DiagramCanvasHandle } from "./diagram/DiagramCanvas";
import {
  type DocumentNotice,
  useDocumentController,
} from "./hooks/useDocumentController";
import { chooseExportPath, exportDiagramFile } from "./native/exportIO";
import { showDocumentError } from "./native/documentIO";
import { useDocumentStore } from "./state/documentStore";
import { useProjectStore } from "./state/projectStore";
import { useUiStore } from "./state/uiStore";

function isEditingText(): boolean {
  const activeElement = document.activeElement;
  return (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable)
  );
}

function App() {
  const canvasRef = useRef<DiagramCanvasHandle>(null);
  const noticeTimer = useRef<number | null>(null);
  const projectName = useProjectStore((state) => state.project.name);
  const activeDiagramName = useProjectStore(
    (state) => state.project.diagrams[state.activeDiagramId]?.name ?? "Diagram",
  );
  const isDirty = useProjectStore((state) => state.isDirty);
  const addEntity = useProjectStore((state) => state.addEntity);
  const deleteSelection = useProjectStore((state) => state.deleteSelection);
  const setSelection = useProjectStore((state) => state.setSelection);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const copySelection = useProjectStore((state) => state.copySelection);
  const pasteEntity = useProjectStore((state) => state.pasteEntity);
  const duplicateEntity = useProjectStore((state) => state.duplicateEntity);
  const addDiagramNote = useProjectStore((state) => state.addDiagramNote);
  const addSubjectArea = useProjectStore((state) => state.addSubjectArea);
  const activeDiagramId = useProjectStore((state) => state.activeDiagramId);
  const selection = useProjectStore((state) => state.selection);
  const canUndo = useProjectStore((state) => state.history.past.length > 0);
  const canRedo = useProjectStore((state) => state.history.future.length > 0);
  const filePath = useDocumentStore((state) => state.filePath);
  const documentActivity = useDocumentStore((state) => state.activity);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const [isArranging, setIsArranging] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [diagramDialogOpen, setDiagramDialogOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [typeLibraryOpen, setTypeLibraryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDimensions, setExportDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [exportPreviews, setExportPreviews] = useState<{
    white: string;
    transparent: string;
  } | null>(null);
  const [notice, setNotice] = useState<DocumentNotice | null>(null);

  const showNotice = useCallback((nextNotice: DocumentNotice) => {
    setNotice(nextNotice);
    if (noticeTimer.current !== null) {
      window.clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = window.setTimeout(
      () => {
        setNotice(null);
        noticeTimer.current = null;
      },
      nextNotice.kind === "error" ? 7_000 : 3_500,
    );
  }, []);

  const documentController = useDocumentController(showNotice);

  function handleAddEntity() {
    const entityId = addEntity();
    requestAnimationFrame(() => canvasRef.current?.focusEntity(entityId));
  }

  function openExportDialog() {
    const title = `${projectName} — ${activeDiagramName}`;
    const exported = canvasRef.current?.createSvg({
      background: "white",
      title,
    });
    const transparent = canvasRef.current?.createSvg({
      background: "transparent",
      title,
    });
    if (!exported || !transparent) {
      showNotice({
        kind: "error",
        message: "The diagram is not ready to export yet.",
      });
      return;
    }
    setExportDimensions({ width: exported.width, height: exported.height });
    setExportPreviews({
      white: exported.svg,
      transparent: transparent.svg,
    });
    setExportOpen(true);
  }

  async function handleExport(options: ExportOptions) {
    if (exportBusy) return;
    const exported = canvasRef.current?.createSvg({
      background: options.background,
      title: `${projectName} — ${activeDiagramName}`,
    });
    if (!exported) return;

    setExportBusy(true);
    try {
      const destination = await chooseExportPath(
        projectName,
        activeDiagramName,
        options.format,
      );
      if (!destination) return;
      await exportDiagramFile(
        options.format,
        destination,
        exported,
        options.pngScale,
        options.pdfPageMode,
      );
      setExportOpen(false);
      showNotice({
        kind: "success",
        message: `${options.format.toUpperCase()} exported successfully.`,
      });
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "Joinery could not export this diagram.";
      showNotice({ kind: "error", message: detail });
      await showDocumentError(detail);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleAutoLayout() {
    if (isArranging) return;
    setIsArranging(true);
    try {
      await canvasRef.current?.autoLayout();
    } finally {
      setIsArranging(false);
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.title = `${isDirty ? "• " : ""}${projectName} — Joinery`;
  }, [isDirty, projectName]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && key === "q") {
        event.preventDefault();
        void documentController.quitApplication();
        return;
      }
      if (modifier && event.shiftKey && key === "e") {
        event.preventDefault();
        openExportDialog();
        return;
      }
      if (modifier && key === "s") {
        event.preventDefault();
        void documentController.saveProject(event.shiftKey);
        return;
      }
      if (modifier && key === "o") {
        event.preventDefault();
        void documentController.openProject();
        return;
      }
      if (modifier && key === "n") {
        event.preventDefault();
        void documentController.newProject();
        return;
      }

      if (isEditingText()) return;

      if (modifier && key === "c") {
        if (copySelection()) event.preventDefault();
        return;
      }
      if (modifier && key === "v") {
        const entityId = pasteEntity();
        if (entityId) {
          event.preventDefault();
          requestAnimationFrame(() => canvasRef.current?.focusEntity(entityId));
        }
        return;
      }
      if (modifier && key === "d" && selection?.kind === "entity") {
        event.preventDefault();
        const entityId = duplicateEntity(selection.id);
        if (entityId) {
          requestAnimationFrame(() => canvasRef.current?.focusEntity(entityId));
        }
        return;
      }

      if (event.key === "Escape") {
        setSelection(null);
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deleteSelection();
      }
      if (modifier && key === "e") {
        event.preventDefault();
        handleAddEntity();
      }
      if (modifier && event.key === "0") {
        event.preventDefault();
        canvasRef.current?.fit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) {
        window.clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

  const NoticeIcon =
    notice?.kind === "success"
      ? CheckCircle2
      : notice?.kind === "error"
        ? XCircle
        : Info;

  return (
    <div className="app-shell">
      <Topbar
        projectName={projectName}
        filePath={filePath}
        isDirty={isDirty}
        documentActivity={documentActivity}
        isArranging={isArranging}
        theme={theme}
        onToggleTheme={toggleTheme}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => undo()}
        onRedo={() => redo()}
        onValidate={() => setValidationOpen(true)}
        onManageTypes={() => setTypeLibraryOpen(true)}
        onExportReport={() => setReportOpen(true)}
        onCompare={() => setCompareOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onNewProject={() => void documentController.newProject()}
        onOpenProject={() => void documentController.openProject()}
        onSaveProject={() => void documentController.saveProject()}
        onSaveProjectAs={() => void documentController.saveProject(true)}
        onQuit={() => void documentController.quitApplication()}
        onExport={openExportDialog}
        onAddRelationship={() => setRelationshipDialogOpen(true)}
        onAddNote={() => addDiagramNote(activeDiagramId)}
        onAddSubjectArea={() => addSubjectArea(activeDiagramId)}
        onAddEntity={handleAddEntity}
        onAutoLayout={handleAutoLayout}
      />
      <div className="workspace">
        <Sidebar
          onManageDiagram={() => setDiagramDialogOpen(true)}
          onFocusEntity={(entityId) => canvasRef.current?.focusEntity(entityId)}
        />
        <main className="canvas-panel">
          <DiagramCanvas ref={canvasRef} />
        </main>
        <Inspector />
      </div>
      <ConfirmDialog />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNotice={showNotice}
      />
      <CompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        onNotice={showNotice}
      />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onNotice={showNotice}
      />
      <TypeLibraryDialog
        open={typeLibraryOpen}
        onClose={() => setTypeLibraryOpen(false)}
      />
      <ValidationDialog
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
      />
      <DiagramDialog
        open={diagramDialogOpen}
        onClose={() => setDiagramDialogOpen(false)}
      />
      <RelationshipDialog
        open={relationshipDialogOpen}
        onClose={() => setRelationshipDialogOpen(false)}
      />
      <ExportDialog
        open={exportOpen}
        busy={exportBusy}
        diagramName={activeDiagramName}
        dimensions={exportDimensions}
        previews={exportPreviews}
        onClose={() => {
          if (!exportBusy) setExportOpen(false);
        }}
        onExport={(options) => void handleExport(options)}
      />
      {notice && (
        <div className={`notice notice-${notice.kind}`} role="status">
          <NoticeIcon size={16} />
          <span>{notice.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
