"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type AlertType = "error" | "success" | "warning" | "info" | "confirm";

export interface AlertModalProps {
  open: boolean;
  type?: AlertType;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

const ICONS: Record<AlertType, { icon: string; bg: string; text: string }> = {
  error:   { icon: "✕", bg: "bg-red-100",   text: "text-red-600"   },
  success: { icon: "✓", bg: "bg-green-100", text: "text-green-600" },
  warning: { icon: "!", bg: "bg-amber-100", text: "text-amber-600" },
  info:    { icon: "i", bg: "bg-blue-100",  text: "text-blue-600"  },
  confirm: { icon: "?", bg: "bg-gray-100",  text: "text-gray-600"  },
};

export default function AlertModal({
  open,
  type = "info",
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Batal",
  onConfirm,
  onCancel,
  onClose,
}: AlertModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") (onCancel ?? onClose ?? onConfirm)?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel, onClose, onConfirm]);

  if (!open) return null;

  const cfg = ICONS[type];
  const isConfirm = !!onCancel;
  const handleConfirm = onConfirm ?? onClose ?? (() => {});
  const handleCancel  = onCancel  ?? onClose ?? (() => {});

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center`}>
            <span className={`text-base font-bold ${cfg.text}`}>{cfg.icon}</span>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            {title && (
              <h3 id="alert-modal-title" className="text-base font-semibold text-gray-900 mb-1">
                {title}
              </h3>
            )}
            <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          {isConfirm && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              type === "error"
                ? "bg-red-600 hover:bg-red-700"
                : type === "warning" || type === "confirm"
                ? "bg-amber-600 hover:bg-amber-700"
                : type === "success"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Hook helper — pengganti alert() dan confirm()
// =====================================================================
export interface AlertState {
  open: boolean;
  type: AlertType;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const INITIAL: AlertState = { open: false, type: "info", message: "" };

export function useAlertModal() {
  const [state, setState] = useState<AlertState>(INITIAL);

  const close = useCallback(() => setState(s => ({ ...s, open: false })), []);

  /** Pengganti alert() */
  const showAlert = useCallback((
    message: string,
    type: AlertType = "error",
    title?: string,
  ) => {
    setState({ open: true, type, title, message });
  }, []);

  /** Pengganti confirm() — return Promise<boolean> */
  const showConfirm = useCallback((
    message: string,
    title?: string,
    confirmLabel = "Ya, lanjutkan",
    cancelLabel  = "Batal",
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        type: "confirm",
        title,
        message,
        confirmLabel,
        cancelLabel,
        onConfirm: () => { setState(s => ({ ...s, open: false })); resolve(true); },
        onCancel:  () => { setState(s => ({ ...s, open: false })); resolve(false); },
      });
    });
  }, []);

  const alertProps: AlertModalProps = {
    ...state,
    onConfirm: state.onConfirm ?? close,
    onCancel:  state.onCancel,
    onClose:   close,
  };

  return { alertProps, showAlert, showConfirm };
}
