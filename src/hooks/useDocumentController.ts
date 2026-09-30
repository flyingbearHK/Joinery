import { useCallback, useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  createRecoverySnapshot,
  deserializeProject,
  deserializeRecoverySnapshot,
  serializeProject,
  serializeRecoverySnapshot,
} from "../domain/document";
import {
  chooseAndReadProject,
  chooseProjectSavePath,
  clearRecovery,
  confirmDiscardChanges,
  confirmRecovery,
  readProjectAtPath,
  readRecovery,
  showDocumentError,
  writeProjectFile,
  writeRecovery,
} from "../native/documentIO";
import { useDocumentStore } from "../state/documentStore";
import { useProjectStore } from "../state/projectStore";

export type NoticeKind = "success" | "info" | "error";
export interface DocumentNotice {
  kind: NoticeKind;
  message: string;
}

type NoticeHandler = (notice: DocumentNotice) => void;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function useDocumentController(onNotice: NoticeHandler) {
  const project = useProjectStore((state) => state.project);
  const isDirty = useProjectStore((state) => state.isDirty);
  const filePath = useDocumentStore((state) => state.filePath);
  const recoveryChecked = useRef(false);

  const reportError = useCallback(
    async (error: unknown, fallback: string) => {
      const detail = errorMessage(error, fallback);
      useDocumentStore.getState().setError(detail);
      useDocumentStore.getState().setActivity("idle");
      onNotice({ kind: "error", message: detail });
      await showDocumentError(detail);
    },
    [onNotice],
  );

  const newProject = useCallback(async () => {
    try {
      const state = useProjectStore.getState();
      if (state.isDirty && !(await confirmDiscardChanges("create a new project"))) {
        return false;
      }

      state.createNewProject();
      useDocumentStore.getState().resetDocumentState();
      await clearRecovery();
      onNotice({ kind: "info", message: "Created a new logical model." });
      return true;
    } catch (error) {
      await reportError(error, "Joinery could not create a new project.");
      return false;
    }
  }, [onNotice, reportError]);

  const quitApplication = useCallback(async () => {
    if (isTauri()) {
      await getCurrentWindow().close();
    } else {
      window.close();
    }
  }, []);

  const openProject = useCallback(async () => {
    const state = useProjectStore.getState();
    if (state.isDirty && !(await confirmDiscardChanges("open another project"))) {
      return false;
    }

    useDocumentStore.getState().setActivity("opening");
    useDocumentStore.getState().setError(null);
    try {
      const opened = await chooseAndReadProject();
      if (!opened) {
        useDocumentStore.getState().setActivity("idle");
        return false;
      }

      const restoredProject = deserializeProject(opened.contents);
      useProjectStore.getState().loadProject(restoredProject);
      useDocumentStore.getState().markSaved(opened.path);
      await clearRecovery();
      onNotice({ kind: "success", message: "Project opened." });
      return true;
    } catch (error) {
      await reportError(error, "Joinery could not open the selected project.");
      return false;
    }
  }, [onNotice, reportError]);

  const openProjectPath = useCallback(
    async (path: string) => {
      const state = useProjectStore.getState();
      if (state.isDirty && !(await confirmDiscardChanges("open another project"))) {
        return false;
      }
      useDocumentStore.getState().setActivity("opening");
      try {
        const opened = await readProjectAtPath(path);
        const restoredProject = deserializeProject(opened.contents);
        useProjectStore.getState().loadProject(restoredProject);
        useDocumentStore.getState().markSaved(opened.path);
        await clearRecovery();
        onNotice({ kind: "success", message: "Project opened." });
        return true;
      } catch (error) {
        await reportError(error, "Joinery could not open this project.");
        return false;
      }
    },
    [onNotice, reportError],
  );

  const saveProject = useCallback(
    async (saveAs = false) => {
      const projectState = useProjectStore.getState();
      const documentState = useDocumentStore.getState();
      documentState.setActivity("saving");
      documentState.setError(null);

      try {
        let destination = saveAs ? null : documentState.filePath;
        if (!destination) {
          destination = await chooseProjectSavePath(
            projectState.project.name,
            saveAs ? documentState.filePath : null,
          );
        }
        if (!destination) {
          useDocumentStore.getState().setActivity("idle");
          return false;
        }

        const projectToSave = useProjectStore.getState().project;
        const contents = serializeProject(projectToSave);
        await writeProjectFile(destination, contents);

        const savedCurrentRevision =
          useProjectStore.getState().project === projectToSave;
        if (savedCurrentRevision) {
          useProjectStore.getState().markSaved();
          await clearRecovery();
        }
        useDocumentStore.getState().markSaved(destination);
        onNotice({
          kind: "success",
          message: savedCurrentRevision
            ? saveAs
              ? "Project saved to a new file."
              : "Project saved."
            : "A snapshot was saved; newer changes remain unsaved.",
        });
        return true;
      } catch (error) {
        await reportError(error, "Joinery could not save this project.");
        return false;
      }
    },
    [onNotice, reportError],
  );

  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;

    async function recoverIfAvailable() {
      useDocumentStore.getState().setActivity("recovering");
      try {
        if (isTauri()) {
          const pendingPath = await invoke<string | null>("take_pending_open_file");
          if (pendingPath) {
            await openProjectPath(pendingPath);
            return;
          }
        }
        const contents = await readRecovery();
        if (!contents) {
          useDocumentStore.getState().setActivity("idle");
          return;
        }

        const snapshot = deserializeRecoverySnapshot(contents);
        const shouldRecover = await confirmRecovery(snapshot.savedAt);

        if (shouldRecover) {
          useProjectStore.getState().loadProject(snapshot.project, true);
          useDocumentStore.getState().setFilePath(snapshot.sourcePath);
          onNotice({ kind: "success", message: "Unsaved work recovered." });
        } else {
          await clearRecovery();
        }
        useDocumentStore.getState().setActivity("idle");
      } catch (error) {
        await clearRecovery().catch(() => undefined);
        await reportError(error, "Joinery could not read the recovery snapshot.");
      }
    }

    void recoverIfAvailable();
  }, [onNotice, openProjectPath, reportError]);

  useEffect(() => {
    if (!isDirty) return;

    const timeout = window.setTimeout(() => {
      try {
        const snapshot = createRecoverySnapshot(project, filePath);
        void writeRecovery(serializeRecoverySnapshot(snapshot)).catch((error) => {
          useDocumentStore
            .getState()
            .setError(errorMessage(error, "Could not write recovery data."));
        });
      } catch (error) {
        useDocumentStore
          .getState()
          .setError(errorMessage(error, "Could not create recovery data."));
      }
    }, 1_200);

    return () => window.clearTimeout(timeout);
  }, [filePath, isDirty, project]);

  useEffect(() => {
    function warnBeforeBrowserClose(event: BeforeUnloadEvent) {
      if (!useProjectStore.getState().isDirty) return;
      event.preventDefault();
      event.returnValue = true;
    }

    window.addEventListener("beforeunload", warnBeforeBrowserClose);
    return () => window.removeEventListener("beforeunload", warnBeforeBrowserClose);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlistenOpen: (() => void) | undefined;
    void listen<string>("joinery://open-file", (event) => {
      void invoke<string | null>("take_pending_open_file").then((pendingPath) =>
        openProjectPath(pendingPath ?? event.payload),
      );
    }).then((stopListening) => {
      if (disposed) {
        stopListening();
        return;
      }
      unlistenOpen = stopListening;
    });
    return () => {
      disposed = true;
      unlistenOpen?.();
    };
  }, [openProjectPath]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          const state = useProjectStore.getState();
          if (state.isDirty) {
            const documentState = useDocumentStore.getState();
            const snapshot = createRecoverySnapshot(
              state.project,
              documentState.filePath,
            );
            await writeRecovery(serializeRecoverySnapshot(snapshot));
          }
          await invoke("exit_application");
        } catch (error) {
          await reportError(
            error,
            "Joinery could not preserve unsaved work before closing.",
          );
        }
      })
      .then((stopListening) => {
        if (disposed) stopListening();
        else unlisten = stopListening;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [reportError]);

  return {
    newProject,
    openProject,
    saveProject,
    quitApplication,
  };
}
