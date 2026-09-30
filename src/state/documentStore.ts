import { create } from "zustand";

export type DocumentActivity = "idle" | "opening" | "saving" | "recovering";

interface DocumentStore {
  filePath: string | null;
  activity: DocumentActivity;
  lastSavedAt: string | null;
  error: string | null;

  setFilePath: (filePath: string | null) => void;
  setActivity: (activity: DocumentActivity) => void;
  setError: (error: string | null) => void;
  markSaved: (filePath: string) => void;
  resetDocumentState: () => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  filePath: null,
  activity: "idle",
  lastSavedAt: null,
  error: null,

  setFilePath: (filePath) => set({ filePath }),
  setActivity: (activity) => set({ activity }),
  setError: (error) => set({ error }),
  markSaved: (filePath) =>
    set({
      filePath,
      activity: "idle",
      lastSavedAt: new Date().toISOString(),
      error: null,
    }),
  resetDocumentState: () =>
    set({
      filePath: null,
      activity: "idle",
      lastSavedAt: null,
      error: null,
    }),
}));

export function fileNameFromPath(filePath: string | null): string | null {
  if (!filePath) return null;
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}
