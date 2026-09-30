import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useUiStore } from "../state/uiStore";

export function ConfirmDialog() {
  const request = useUiStore((state) => state.confirmRequest);
  const resolve = useUiStore((state) => state.resolveConfirm);
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    cancelButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") resolve(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request, resolve]);

  if (!request) return null;

  return (
    <div
      className="modal-backdrop confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resolve(false);
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="confirm-icon" aria-hidden="true">
          <AlertTriangle size={19} />
        </div>
        <div className="confirm-copy">
          <h2 id="confirm-title">{request.title}</h2>
          <p id="confirm-message">{request.message}</p>
        </div>
        <footer className="confirm-actions">
          <button
            ref={cancelButton}
            type="button"
            className="button button-secondary"
            onClick={() => resolve(false)}
          >
            {request.cancelLabel}
          </button>
          <button
            type="button"
            className={`button ${
              request.destructive ? "button-danger" : "button-primary"
            }`}
            onClick={() => resolve(true)}
          >
            {request.confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
