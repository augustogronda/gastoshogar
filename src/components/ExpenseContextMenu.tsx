"use client";

import React, { useEffect, useState } from "react";
import {
  Edit3,
  Trash2,
  Repeat,
  Copy,
  CategoryIcon,
  User,
  Calendar,
  X,
} from "./ui/icons";
import { triggerHaptic } from "@/lib/haptics";

export interface ContextMenuExpense {
  id: string;
  title: string;
  amount: number;
  date: Date | string;
  category?: { id?: string; name: string; icon?: string | null } | null;
  paidBy?: { id: string; name: string };
  isPersonal?: boolean;
  notes?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
}

interface ExpenseContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ContextMenuExpense | null;
  isPersonal?: boolean;
  onOpenDetail: (expense: ContextMenuExpense) => void;
  onCopyExpense?: (expenseId: string) => void;
  onMoveExpense: (expenseId: string) => void;
  onDeleteExpense: (expenseId: string) => void;
}

export function ExpenseContextMenu({
  isOpen,
  onClose,
  expense,
  isPersonal = false,
  onOpenDetail,
  onCopyExpense,
  onMoveExpense,
  onDeleteExpense,
}: ExpenseContextMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmDelete(false);
      // Prevenir scroll en body mientras el menú contextual está activo
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !expense) return null;

  const dateObj = new Date(expense.date);
  const formattedDate = dateObj.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Opciones de gasto"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm flex flex-col items-center animate-scale-up"
      >
        {/* ============================================================ */}
        {/* PREVIEW "PEEK" ELEVADO ESTILO APPLE HIG                     */}
        {/* ============================================================ */}
        <div className="w-full super-card rounded-2xl p-4 border border-white/20 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-zinc-800/90 border border-white/[0.1] flex items-center justify-center text-zinc-200 shrink-0 shadow-inner">
                <CategoryIcon
                  name={expense.category?.name || "General"}
                  icon={expense.category?.icon}
                  className="w-5 h-5 text-blue-400"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-white truncate tracking-tight">
                  {expense.title}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                  <span className="truncate">
                    {expense.category?.name || "Sin categoría"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="w-3 h-3 text-zinc-500" />
                    <span>{formattedDate}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-lg font-extrabold text-white font-mono tabular-nums tracking-tight">
                ${Math.round(expense.amount).toLocaleString("es-AR")}
              </span>
              {!isPersonal && expense.paidBy && (
                <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-400 mt-0.5">
                  <User className="w-3 h-3 text-zinc-500" />
                  <span>{expense.paidBy.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MENÚ FLOTANTE NATIVO iOS (APPLE CONTEXT MENU)                */}
        {/* ============================================================ */}
        <div className="w-full mt-3 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/[0.14] shadow-2xl overflow-hidden divide-y divide-white/[0.08]">
          {/* Opción 1: Ver Detalle y Editar */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onClose();
              onOpenDetail(expense);
            }}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left text-sm font-medium text-white hover:bg-white/[0.08] active:bg-white/[0.15] transition"
          >
            <span>Ver detalle y editar</span>
            <Edit3 className="w-4 h-4 text-blue-400 shrink-0" />
          </button>

          {/* Opción 2: Copiar entre Compartido y Personal */}
          {onCopyExpense && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onClose();
                onCopyExpense(expense.id);
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left text-sm font-medium text-white hover:bg-white/[0.08] active:bg-white/[0.15] transition"
            >
              <span>
                {isPersonal
                  ? "Copiar a Fondo Compartido (Hogar)"
                  : "Copiar a Gastos Personales"}
              </span>
              <Copy className="w-4 h-4 text-cyan-400 shrink-0" />
            </button>
          )}

          {/* Opción 3: Mover entre Compartido y Personal */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(12);
              onClose();
              onMoveExpense(expense.id);
            }}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left text-sm font-medium text-white hover:bg-white/[0.08] active:bg-white/[0.15] transition"
          >
            <span>
              {isPersonal
                ? "Mover a Fondo Compartido (Hogar)"
                : "Mover a Gastos Personales"}
            </span>
            <Repeat className="w-4 h-4 text-purple-400 shrink-0" />
          </button>

          {/* Opción 3: Eliminar Gasto (Destructive Action Apple HIG) */}
          {confirmDelete ? (
            <div className="px-4 py-3 bg-rose-500/15 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-rose-300">
                ¿Confirmar eliminación?
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-xs text-zinc-300 hover:text-white rounded-lg bg-white/[0.06] transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onClose();
                    onDeleteExpense(expense.id);
                  }}
                  className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm transition active:scale-95"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setConfirmDelete(true);
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left text-sm font-medium text-[#ff453a] hover:bg-rose-500/10 active:bg-rose-500/20 transition"
            >
              <span>Eliminar gasto</span>
              <Trash2 className="w-4 h-4 text-[#ff453a] shrink-0" />
            </button>
          )}
        </div>

        {/* Botón flotante para cancelar o cerrar */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            onClose();
          }}
          className="mt-3.5 text-xs font-semibold text-zinc-400 hover:text-white py-1.5 px-4 rounded-full bg-white/[0.04] border border-white/[0.08] transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
