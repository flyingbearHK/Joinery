import { create } from "zustand";
import type { EntityId } from "../domain/model";

export type Theme = "light" | "dark";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmRequest extends Required<Omit<ConfirmOptions, "destructive">> {
  destructive: boolean;
  resolve: (confirmed: boolean) => void;
}

export interface BulkImportRequest {
  requestId: number;
  entityId: EntityId | null;
  initialText: string;
}

interface UiStore {
  theme: Theme;
  confirmRequest: ConfirmRequest | null;
  bulkImport: BulkImportRequest | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
  openBulkImport: (entityId: EntityId | null, initialText?: string) => void;
  closeBulkImport: () => void;
}

let nextBulkImportRequestId = 0;

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("joinery-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const useUiStore = create<UiStore>((set, get) => ({
  theme: initialTheme(),
  confirmRequest: null,
  bulkImport: null,

  setTheme: (theme) => {
    window.localStorage.setItem("joinery-theme", theme);
    set({ theme });
  },

  toggleTheme: () => {
    get().setTheme(get().theme === "light" ? "dark" : "light");
  },

  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({
        confirmRequest: {
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? "Confirm",
          cancelLabel: options.cancelLabel ?? "Cancel",
          destructive: options.destructive ?? false,
          resolve,
        },
      });
    }),

  resolveConfirm: (confirmed) => {
    const request = get().confirmRequest;
    if (!request) return;
    set({ confirmRequest: null });
    request.resolve(confirmed);
  },

  openBulkImport: (entityId, initialText = "") => {
    nextBulkImportRequestId += 1;
    set({
      bulkImport: {
        requestId: nextBulkImportRequestId,
        entityId,
        initialText,
      },
    });
  },

  closeBulkImport: () => {
    set({ bulkImport: null });
  },
}));
