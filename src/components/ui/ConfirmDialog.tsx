"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Trash2, Unlock, Lock, Sparkles, X } from "./icons";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const iconBg =
    variant === "danger"
      ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
      : variant === "warning"
      ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
      : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400";

  const buttonBg =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30 border-rose-400/20"
      : variant === "warning"
      ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 border-amber-400/20"
      : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 border-indigo-400/20";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      style={{ minHeight: "100vh", minWidth: "100vw" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm super-card rounded-3xl p-6 shadow-2xl border border-white/[0.12] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${iconBg}`}
            >
              {variant === "danger" ? (
                <Trash2 className="w-4 h-4" />
              ) : variant === "warning" ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-1 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="py-2.5 px-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 font-semibold text-xs active:scale-95 transition border border-white/[0.08]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`py-2.5 px-4 rounded-2xl text-white font-bold text-xs shadow-lg active:scale-95 transition border disabled:opacity-50 ${buttonBg}`}
          >
            {isLoading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export function useToast() {
  const [toast, setToast] = useState<ToastItem | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      const id = Date.now();
      setToast({ id, message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 3000);
    },
    []
  );

  return { toast, showToast };
}

export function ToastBanner({ toast }: { toast: ToastItem | null }) {
  if (!toast) return null;

  const styles =
    toast.type === "error"
      ? "bg-rose-600/95 border-rose-400/40 shadow-rose-950/50 text-white"
      : toast.type === "info"
      ? "bg-indigo-600/95 border-indigo-400/40 shadow-indigo-950/50 text-white"
      : "bg-emerald-600/95 border-emerald-400/40 shadow-emerald-950/50 text-white";

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full text-xs font-bold shadow-xl border backdrop-blur-md flex items-center gap-2 animate-fade-in max-w-[92vw] ${styles}`}
    >
      {toast.type === "error" ? (
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
      )}
      <span className="truncate">{toast.message}</span>
    </div>
  );
}
