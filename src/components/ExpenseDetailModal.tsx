"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Copy,
  Calendar,
  CategoryIcon,
  Check,
  User,
  Sparkles,
  Layers,
  Edit3,
} from "./ui/icons";
import {
  updateExpenseAction,
  duplicateExpenseAction,
  deleteExpenseAction,
  updatePersonalExpenseAction,
  duplicatePersonalExpenseAction,
  deletePersonalExpenseAction,
} from "@/app/actions";

export interface CategoryItem {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface HouseholdUserItem {
  id: string;
  name: string;
  avatarColor: string;
}

export interface EditableExpense {
  id: string;
  title: string;
  amount: number;
  date: Date | string;
  categoryId?: string | null;
  category?: CategoryItem | null;
  paidById?: string;
  paidBy?: { id: string; name: string };
  isFromPoolFund?: boolean;
  notes?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  isPersonal?: boolean;
}

interface ExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: EditableExpense | null;
  users?: HouseholdUserItem[];
  categories: CategoryItem[];
  isPersonal?: boolean;
}

export function ExpenseDetailModal({
  isOpen,
  onClose,
  expense,
  users = [],
  categories,
  isPersonal = false,
}: ExpenseDetailModalProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paidById, setPaidById] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title || "");
      setAmount(expense.amount ? expense.amount.toString() : "");
      setCategoryId(expense.categoryId || expense.category?.id || categories[0]?.id || "");
      setPaidById(expense.paidById || expense.paidBy?.id || users[0]?.id || "");
      
      const d = expense.date ? new Date(expense.date) : new Date();
      setDate(d.toISOString().split("T")[0]);
      
      setNotes(expense.notes || "");
    }
  }, [expense, categories, users]);

  if (!isOpen || !expense) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title || !parsedAmount || parsedAmount <= 0) {
      alert("Completá el título y un monto válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isPersonal) {
        await updatePersonalExpenseAction({
          id: expense.id,
          title,
          amount: parsedAmount,
          categoryId: categoryId || undefined,
          date,
          notes: notes || undefined,
        });
      } else {
        await updateExpenseAction({
          id: expense.id,
          title,
          amount: parsedAmount,
          paidById: paidById || users[0]?.id || "",
          categoryId: categoryId || categories[0]?.id || "",
          date,
          notes: notes || undefined,
          isFromPoolFund: expense.isFromPoolFund,
        });
      }
      onClose();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error al actualizar gasto");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    if (confirm("¿Duplicar este gasto para cargarlo nuevamente?")) {
      setIsDuplicating(true);
      try {
        if (isPersonal) {
          await duplicatePersonalExpenseAction(expense.id);
        } else {
          await duplicateExpenseAction(expense.id);
        }
        onClose();
      } catch (err: unknown) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Error al duplicar gasto");
      } finally {
        setIsDuplicating(false);
      }
    }
  };

  const handleDelete = async () => {
    if (confirm("¿Estás seguro de eliminar este gasto definitivamente?")) {
      setIsDeleting(true);
      try {
        if (isPersonal) {
          await deletePersonalExpenseAction(expense.id);
        } else {
          await deleteExpenseAction(expense.id);
        }
        onClose();
      } catch (err: unknown) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Error al eliminar gasto");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md super-card rounded-3xl p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isPersonal
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              }`}
            >
              <Edit3 className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Detalle del Gasto
              </h2>
              <span className="text-[10px] text-zinc-400 font-medium block">
                {isPersonal ? "Espacio Personal" : "Fondo Compartido Hogar"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          
          {/* Campo Monto Grande */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 text-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Monto del Gasto
            </label>
            <div className="relative inline-flex items-center justify-center">
              <span className="text-2xl font-bold font-mono text-zinc-400 mr-1">$</span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent text-3xl font-extrabold text-white font-mono tabular-nums text-center focus:outline-none w-44"
              />
            </div>
          </div>

          {/* Título o Concepto */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Nombre / Concepto
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Selector de Pagador en Hogar (Augusto vs Agus) */}
          {!isPersonal && users.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                ¿Quién lo pagó?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {users.map((u) => {
                  const isSelected = paidById === u.id;
                  const isAugusto = u.name.toLowerCase().includes("augusto");

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setPaidById(u.id)}
                      className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        isSelected
                          ? isAugusto
                            ? "bg-blue-600/30 border-blue-400 text-blue-200 shadow-md shadow-blue-600/20"
                            : "bg-rose-600/30 border-rose-400 text-rose-200 shadow-md shadow-rose-600/20"
                          : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white"
                      }`}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: u.avatarColor }}
                      />
                      <span>Pagó {u.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selector de Categoría */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-2">
              Categoría
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto no-scrollbar p-1">
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? "bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-600/20"
                        : "bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-xl bg-white/[0.08] flex items-center justify-center mb-1">
                      <CategoryIcon name={cat.name} className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Fecha del gasto
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl py-2.5 px-3 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notas / Descripción Enriquecida */}
          <div>
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              Notas / Descripción Detallada
            </label>
            <textarea
              rows={3}
              placeholder="Ej. Asado del fin de semana, incluye cosas de limpieza para 2 meses..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-2xl p-3 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none leading-relaxed"
            />
          </div>

          {/* Cuotas info si aplica */}
          {expense.totalInstallments && (
            <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-purple-200">
              <Layers className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                Este gasto forma parte de una compra en cuotas (Cuota{" "}
                <strong className="text-white">{expense.installmentNumber}</strong> de{" "}
                <strong className="text-white">{expense.totalInstallments}</strong>).
              </span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting || isDuplicating || isDeleting}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-400/20"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Guardando cambios..." : "Guardar Cambios"}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={isSubmitting || isDuplicating || isDeleting}
                className="py-3 px-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] border border-white/[0.08]"
                title="Crear una copia exacta de este gasto"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>{isDuplicating ? "Copiando..." : "Duplicar Gasto"}</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || isDuplicating || isDeleting}
                className="py-3 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] border border-rose-500/20"
                title="Eliminar este gasto"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{isDeleting ? "Eliminando..." : "Eliminar"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
